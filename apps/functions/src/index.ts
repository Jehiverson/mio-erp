import { createHash, randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret, defineString } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import {
  InputError,
  canEdit,
  operationId,
  parseAnalyze,
  parseProduct,
  productCode,
  photoPathInStore,
  record,
  segment,
  type AiDraft,
} from '../../../packages/shared/src/index.js';
import { analyzeWithQwen, QwenError } from './qwen.js';
initializeApp();
const db = getFirestore();
const qwenEnabled = process.env.ENABLE_QWENCLOUD === 'true';
const qwenKey = qwenEnabled ? defineSecret('QWENCLOUD_API_KEY') : undefined;
const qwenRegion = defineString('QWENCLOUD_REGION', { default: 'ap-southeast-1' });
const qwenModel = defineString('QWENCLOUD_MODEL', { default: 'qwen3-vl-plus' });
const productBucket = defineString('PRODUCT_STORAGE_BUCKET');
const functionsRegion = defineString('FUNCTIONS_REGION', { default: 'us-central1' });
setGlobalOptions({ region: functionsRegion, maxInstances: 2 });
const appCheck = process.env.FUNCTIONS_EMULATOR !== 'true';
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function identity(request: CallableRequest<unknown>) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const input = record(request.data);
  return { uid: segment(request.auth.uid, 'Usuario'), storeId: segment(input.storeId, 'Tienda'), input };
}
function authorized(member: Record<string, unknown> | undefined) {
  if (!member || member.active !== true || !canEdit(member.role))
    throw new HttpsError('permission-denied', 'Tu cuenta no tiene permiso para operar en esta tienda.');
}
function translated(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof InputError) return new HttpsError('invalid-argument', error.message);
  if (error instanceof QwenError)
    return new HttpsError(
      error.kind === 'rate-limit'
        ? 'resource-exhausted'
        : error.kind === 'configuration'
          ? 'failed-precondition'
          : 'unavailable',
      error.message,
    );
  return new HttpsError('internal', 'No se pudo completar la operación. Conserva el formulario y reintenta.');
}
export const saveInventoryProduct = onCall(
  { enforceAppCheck: appCheck, timeoutSeconds: 30 },
  async (request) => {
    try {
      const { uid, storeId, input } = identity(request);
      const opId = operationId(input.operationId);
      const fields = parseProduct(input.product);
      const productId = segment(input.productId, 'Producto');
      const expectedRevision = input.expectedRevision;
      if (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 0)
        throw new InputError('Versión de producto no válida.');
      const store = db.collection('stores').doc(storeId);
      const memberRef = store.collection('members').doc(uid);
      authorized((await memberRef.get()).data());
      if (fields.photoPath) {
        photoPathInStore(fields.photoPath, storeId);
        const [meta] = await getStorage().bucket(productBucket.value()).file(fields.photoPath).getMetadata();
        if (meta.contentType !== 'image/jpeg' || Number(meta.size) <= 0 || Number(meta.size) > 1_048_576)
          throw new InputError('La fotografía no es un JPEG válido de hasta 1 MB.');
      }
      const creating = expectedRevision === 0;
      const productRef = store.collection('products').doc(productId);
      const opRef = store.collection('operations').doc(opId);
      const counterRef = store.collection('counters').doc('products');
      const fingerprint = sha({ productId, expectedRevision, fields });
      return await db.runTransaction(async (tx) => {
        const [member, op, existing, counter] = await Promise.all([
          tx.get(memberRef),
          tx.get(opRef),
          tx.get(productRef),
          tx.get(counterRef),
        ]);
        authorized(member.data());
        if (op.exists) {
          const old = op.data()!;
          if (old.uid !== uid || old.fingerprint !== fingerprint)
            throw new HttpsError(
              'already-exists',
              'Este identificador ya se usó para una operación distinta.',
            );
          return old.result as { id: string; code: string; revision: number };
        }
        if (creating && existing.exists)
          throw new HttpsError(
            'already-exists',
            'Este producto ya fue creado. Cierra y revisa el inventario antes de volver a guardar.',
          );
        if (!creating) {
          if (!existing.exists) throw new HttpsError('not-found', 'Producto no encontrado.');
          if (existing.get('status') !== 'Disponible')
            throw new HttpsError('failed-precondition', 'Solo puedes editar productos disponibles.');
          if (existing.get('revision') !== expectedRevision)
            throw new HttpsError(
              'aborted',
              'El producto cambió. Cierra y vuelve a abrir el detalle antes de editar.',
            );
        }
        const sequence = counter.exists ? counter.get('next') : 1;
        if (!Number.isSafeInteger(sequence) || sequence < 1)
          throw new HttpsError('failed-precondition', 'La secuencia de inventario requiere revisión.');
        const revision = creating ? 1 : Number(expectedRevision) + 1;
        const code = creating ? productCode(sequence) : (existing.get('code') as string);
        const now = new Date().toISOString();
        if (!creating) tx.update(productRef, { ...fields, revision, updatedAt: now, updatedBy: uid });
        else {
          tx.create(productRef, {
            ...fields,
            code,
            status: 'Disponible',
            queue: [],
            revision,
            createdAt: now,
            updatedAt: now,
            createdBy: uid,
          });
          tx.set(counterRef, { next: sequence + 1 });
        }
        const result = { id: productRef.id, code, revision };
        tx.create(opRef, { uid, fingerprint, result, kind: 'inventory-save', at: now });
        return result;
      });
    } catch (error) {
      throw translated(error);
    }
  },
);
export const analyzeInventoryProduct = onCall(
  { secrets: qwenKey ? [qwenKey] : [], enforceAppCheck: appCheck, timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    let operation: FirebaseFirestore.DocumentReference | undefined;
    let lease = '';
    try {
      const { uid, storeId, input } = identity(request);
      if (!qwenEnabled)
        throw new HttpsError(
          'failed-precondition',
          'QwenCloud está pendiente de activación en la próxima fase. Continúa con el registro manual.',
        );
      const analysis = parseAnalyze(input);
      const store = db.collection('stores').doc(storeId);
      operation = store.collection('aiOperations').doc(analysis.operationId);
      const memberRef = store.collection('members').doc(uid);
      const day = new Date().toISOString().slice(0, 10);
      const storeQuota = store.collection('aiUsage').doc(day);
      const userQuota = store.collection('aiUsage').doc(`${day}_${uid}`);
      const fingerprint = sha({ text: analysis.text, image: analysis.image });
      lease = randomUUID();
      const now = Date.now();
      const cached = await db.runTransaction(async (tx) => {
        const [member, op, storeUsage, userUsage] = await Promise.all([
          tx.get(memberRef),
          tx.get(operation!),
          tx.get(storeQuota),
          tx.get(userQuota),
        ]);
        authorized(member.data());
        if (op.exists) {
          if (op.get('uid') !== uid || op.get('fingerprint') !== fingerprint)
            throw new HttpsError('already-exists', 'Este análisis pertenece a otra solicitud.');
          if (op.get('status') === 'complete') return op.get('draft') as AiDraft;
          if (op.get('status') === 'pending' && now - Number(op.get('startedAt')) < 120_000)
            throw new HttpsError('aborted', 'El análisis sigue en curso. Espera antes de reintentar.');
        }
        const storeCount = storeUsage.exists ? Number(storeUsage.get('count')) : 0,
          userCount = userUsage.exists ? Number(userUsage.get('count')) : 0;
        if (
          !Number.isSafeInteger(storeCount) ||
          !Number.isSafeInteger(userCount) ||
          storeCount >= 40 ||
          userCount >= 20
        )
          throw new HttpsError(
            'resource-exhausted',
            'Se alcanzó el límite diario de análisis para esta tienda o usuario.',
          );
        tx.set(storeQuota, { count: storeCount + 1 });
        tx.set(userQuota, { count: userCount + 1 });
        tx.set(operation!, { uid, fingerprint, status: 'pending', lease, startedAt: now });
        return null;
      });
      if (cached) return { draft: cached };
      const draft = await analyzeWithQwen(analysis, {
        key: qwenKey?.value() || '',
        region: qwenRegion.value(),
        model: qwenModel.value(),
      });
      await db.runTransaction(async (tx) => {
        const op = await tx.get(operation!);
        if (op.get('lease') !== lease)
          throw new HttpsError('aborted', 'La solicitud cambió. Reintenta el análisis.');
        tx.update(operation!, { status: 'complete', draft, completedAt: Date.now() });
      });
      return { draft };
    } catch (error) {
      if (operation && lease)
        await db
          .runTransaction(async (tx) => {
            const op = await tx.get(operation!);
            if (op.exists && op.get('lease') === lease && op.get('status') === 'pending')
              tx.update(operation!, { status: 'failed', completedAt: Date.now() });
          })
          .catch(() => undefined);
      throw translated(error);
    }
  },
);
