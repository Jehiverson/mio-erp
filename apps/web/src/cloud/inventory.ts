import { httpsCallable } from 'firebase/functions';
import { getBlob, getMetadata, ref, uploadBytes } from 'firebase/storage';
import { parseProduct, type AiDraft, type StoredProduct } from '@hackaton/shared';
import { firebaseClient, storeId, qwenEnabled } from './client';
import { cents, type Product, type ProductDraft } from '../prototype/model';
export type CloudProduct = Product & { revision: number; photoPath: string };
export type SaveRequest = {
  operationId: string;
  productId: string;
  expectedRevision: number;
  product: ReturnType<typeof parseProduct>;
};
export type SaveResult = { id: string; code: string; revision: number };
export async function saveCloudProduct(
  draft: ProductDraft,
  operationId: string,
  previous: CloudProduct | undefined,
  targetId: string,
) {
  const { auth, storage, functions } = firebaseClient();
  if (!auth.currentUser) throw new Error('Inicia sesión para guardar.');
  const clean = parseProduct({
    name: draft.name,
    type: draft.type,
    origin: draft.origin,
    brand: draft.brand,
    size: draft.size,
    cost: cents(draft.cost),
    price: cents(draft.price),
    description: draft.description,
    photoPath: previous?.photoPath || '',
  });
  let photoPath = previous?.photoPath || '';
  if (draft.photo && draft.photo !== previous?.photo) {
    if (!draft.photo.startsWith('data:image/jpeg;base64,'))
      throw new Error('Selecciona una foto JPEG válida.');
    const blob = await (await fetch(draft.photo)).blob();
    if (blob.size > 1_048_576) throw new Error('La foto comprimida supera 1 MB. Selecciona otra imagen.');
    const bytes = await blob.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
    photoPath = `stores/${storeId}/uploads/${auth.currentUser.uid}/${operationId}.jpg`;
    const photoRef = ref(storage, photoPath);
    try {
      const meta = await getMetadata(photoRef);
      if (meta.customMetadata?.sha256 !== hash)
        throw new Error('La foto cambió. Cierra y vuelve a abrir el formulario antes de guardar.');
    } catch (error) {
      if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
      await uploadBytes(photoRef, blob, { contentType: 'image/jpeg', customMetadata: { sha256: hash } });
    }
  }
  const call = httpsCallable<SaveRequest & { storeId: string }, SaveResult>(
    functions,
    'saveInventoryProduct',
  );
  const result = await call({
    storeId,
    operationId,
    productId: targetId,
    expectedRevision: previous?.revision || 0,
    product: { ...clean, photoPath },
  });
  return result.data;
}
export async function analyzeCloudProduct(
  text: string,
  image: string,
  operationId: string,
): Promise<AiDraft> {
  if (!qwenEnabled) throw new Error('La carga con QwenCloud estará disponible en la próxima fase.');
  const call = httpsCallable<
    { storeId: string; operationId: string; text: string; image: string },
    { draft: AiDraft }
  >(firebaseClient().functions, 'analyzeInventoryProduct', { timeout: 65_000 });
  const result = await call({ storeId, operationId, text, image });
  return result.data.draft;
}
export async function displayProduct(
  stored: StoredProduct,
  cache: Map<string, Promise<string>>,
): Promise<CloudProduct> {
  let photo = '';
  if (stored.photoPath) {
    let request = cache.get(stored.photoPath);
    if (!request) {
      request = getBlob(ref(firebaseClient().storage, stored.photoPath), 1_048_576).then((blob) =>
        URL.createObjectURL(blob),
      );
      cache.set(stored.photoPath, request);
    }
    try {
      photo = await request;
    } catch {
      cache.delete(stored.photoPath);
    }
  }
  return { ...stored, photo };
}
