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
  const photos = draft.photos || (draft.photo ? [draft.photo] : []);
  if (photos.length > 6) throw new Error('Puedes guardar hasta 6 fotos por producto.');
  const previousPhotos = previous?.photos || (previous?.photo ? [previous.photo] : []);
  const previousPaths = previous?.photoPaths || (previous?.photoPath ? [previous.photoPath] : []);
  if (previousPaths.length && previousPhotos.some((photo) => !photo))
    throw new Error('No se pudieron cargar todas las fotos. Recarga antes de editar para conservarlas.');
  const photoPaths: string[] = [];
  for (const [index, photo] of photos.entries()) {
    const oldIndex = previousPhotos.indexOf(photo);
    if (oldIndex !== -1 && previousPaths[oldIndex]) {
      photoPaths.push(previousPaths[oldIndex]);
      continue;
    }
    if (!photo.startsWith('data:image/jpeg;base64,'))
      throw new Error('Selecciona una foto JPEG válida.');
    const blob = await (await fetch(photo)).blob();
    if (blob.size > 1_048_576) throw new Error('Una foto comprimida supera 1 MB. Selecciona otra imagen.');
    const bytes = await blob.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
      .map((v) => v.toString(16).padStart(2, '0')).join('');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${operationId}:${index}`)));
    digest[6] = (digest[6] & 15) | 64;
    digest[8] = (digest[8] & 63) | 128;
    const hex = Array.from(digest.slice(0, 16)).map((v) => v.toString(16).padStart(2, '0')).join('');
    const photoId = index === 0 ? operationId : `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    const path = `stores/${storeId}/uploads/${auth.currentUser.uid}/${photoId}.jpg`;
    const photoRef = ref(storage, path);
    try {
      const meta = await getMetadata(photoRef);
      if (meta.customMetadata?.sha256 !== hash)
        throw new Error('La foto cambió. Cierra y vuelve a abrir el formulario antes de guardar.');
    } catch (error) {
      if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
      await uploadBytes(photoRef, blob, { contentType: 'image/jpeg', customMetadata: { sha256: hash } });
    }
    photoPaths.push(path);
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
    product: { ...clean, photoPath: photoPaths[0] || '', photoPaths },
  });
  return result.data;
}
export async function analyzeCloudProduct(
  text: string,
  images: string[],
  operationId: string,
): Promise<AiDraft> {
  if (!qwenEnabled) throw new Error('La carga con QwenCloud estará disponible en la próxima fase.');
  const call = httpsCallable<
    { storeId: string; operationId: string; text: string; image: string; images: string[] },
    { draft: AiDraft }
  >(firebaseClient().functions, 'analyzeInventoryProduct', { timeout: 65_000 });
  const result = await call({ storeId, operationId, text, image: images[0] || '', images });
  return result.data.draft;
}
export async function displayProduct(
  stored: StoredProduct,
  cache: Map<string, Promise<string>>,
): Promise<CloudProduct> {
  const paths = stored.photoPaths || (stored.photoPath ? [stored.photoPath] : []);
  const photos = await Promise.all(paths.map(async (path) => {
    let request = cache.get(path);
    if (!request) {
      request = getBlob(ref(firebaseClient().storage, path), 1_048_576).then((blob) => URL.createObjectURL(blob));
      cache.set(path, request);
    }
    try { return await request; }
    catch { cache.delete(path); return ''; }
  }));
  return { ...stored, photo: photos[0] || '', photos };
}
