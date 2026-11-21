import { InputError, amount, operationId, record, segment } from './validation.js';
export { InputError, amount, operationId, record, segment } from './validation.js';
export const productTypes = ['Artesanía', 'Decoración', 'Ropa', 'Calzado', 'Accesorio', 'Otro'] as const;
export const productOrigins = ['Nacional', 'Importado', 'Segunda mano', 'Otro'] as const;
export type ProductFields = {
  name: string;
  type: string;
  brand: string;
  size: string;
  origin: string;
  cost: number;
  price: number;
  description: string;
  photoPath: string;
  photoPaths?: string[];
};
export type StoredProduct = ProductFields & {
  id: string;
  code: string;
  status: 'Disponible' | 'En Live' | 'Reservado' | 'Vendido' | 'En revisión';
  queue: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};
export type AiDraft = {
  name: string | null;
  type: string | null;
  brand: string | null;
  size: string | null;
  origin: string | null;
  cost: number | null;
  price: number | null;
  description: string | null;
};
export type AnalyzeInput = { operationId: string; text: string; image: string; images?: string[] };
function text(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw new InputError(`${label}: completa un texto válido de hasta ${max} caracteres.`);
  return value.trim();
}
export function parseProduct(value: unknown): ProductFields {
  const v = record(value);
  const keys = ['name', 'type', 'brand', 'size', 'origin', 'cost', 'price', 'description', 'photoPath', 'photoPaths'];
  if (Object.keys(v).some((k) => !keys.includes(k)))
    throw new InputError('El producto contiene campos no permitidos.');
  const type = text(v.type, 'Tipo', 40, true),
    origin = text(v.origin, 'Procedencia', 40, true);
  if (
    !productTypes.includes(type as (typeof productTypes)[number]) ||
    !productOrigins.includes(origin as (typeof productOrigins)[number])
  )
    throw new InputError('Tipo o procedencia fuera del catálogo.');
  let photoPaths: string[] | undefined;
  if (v.photoPaths !== undefined) {
    if (!Array.isArray(v.photoPaths) || v.photoPaths.length > 6)
      throw new InputError('Puedes guardar hasta 6 fotografías por producto.');
    photoPaths = v.photoPaths.map((p) => text(p, 'Fotografía', 400, true));
    if (new Set(photoPaths).size !== photoPaths.length || (photoPaths[0] || '') !== v.photoPath)
      throw new InputError('La portada debe coincidir con la primera fotografía, sin duplicados.');
  }
  return {
    ...(photoPaths === undefined ? {} : { photoPaths }),
    name: text(v.name, 'Nombre', 100, true),
    type,
    brand: text(v.brand, 'Marca', 80),
    size: text(v.size, 'Talla', 40),
    origin,
    cost: amount(v.cost, true),
    price: amount(v.price),
    description: text(v.description, 'Descripción', 3000),
    photoPath: text(v.photoPath, 'Fotografía', 400),
  };
}
export function productCode(sequence: number) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new InputError('Secuencia no válida.');
  let group = Math.floor((sequence - 1) / 9999),
    prefix = '';
  do {
    prefix = String.fromCharCode(65 + (group % 26)) + prefix;
    group = Math.floor(group / 26) - 1;
  } while (group >= 0);
  return `${prefix}${String(((sequence - 1) % 9999) + 1).padStart(4, '0')}`;
}
export function parseAnalyze(value: unknown): AnalyzeInput {
  const v = record(value),
    op = operationId(v.operationId);
  const notes = text(v.text, 'Notas', 4000);
  if (typeof v.image !== 'string') throw new InputError('Fotografía no válida.');
  const image = v.image;
  if (image) {
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length > 1_400_000)
      throw new InputError('La imagen debe ser JPEG y pesar como máximo 1 MB.');
  }
  let images: string[] | undefined;
  if (v.images !== undefined) {
    if (!Array.isArray(v.images) || v.images.length > 6)
      throw new InputError('Puedes analizar hasta 6 fotografías.');
    images = v.images.map((item) => {
      if (typeof item !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(item) || item.length > 1_400_000)
        throw new InputError('Cada imagen debe ser JPEG y pesar como máximo 1 MB.');
      return item;
    });
    if ((images[0] || '') !== image) throw new InputError('La portada del análisis no coincide.');
  }
  if (!notes && !image) throw new InputError('Agrega una foto o notas del producto.');
  return { operationId: op, text: notes, image, ...(images === undefined ? {} : { images }) };
}
export function parseAiDraft(value: unknown): AiDraft {
  const v = record(value);
  const keys = ['name', 'type', 'brand', 'size', 'origin', 'cost', 'price', 'description'];
  if (Object.keys(v).some((k) => !keys.includes(k)) || keys.some((k) => !(k in v)))
    throw new InputError('El borrador IA no tiene el formato esperado.');
  const nullable = (key: string, max: number) => (v[key] === null ? null : text(v[key], key, max));
  const result: AiDraft = {
    name: nullable('name', 100),
    type: nullable('type', 40),
    brand: nullable('brand', 80),
    size: nullable('size', 40),
    origin: nullable('origin', 40),
    description: nullable('description', 3000),
    cost: v.cost === null ? null : amount(v.cost, true),
    price: v.price === null ? null : amount(v.price),
  };
  if (result.type && !productTypes.includes(result.type as (typeof productTypes)[number])) result.type = null;
  if (result.origin && !productOrigins.includes(result.origin as (typeof productOrigins)[number]))
    result.origin = null;
  return result;
}
export const canEdit = (role: unknown) => role === 'admin' || role === 'editor';
export * from './commerce.js';

export function photoPathInStore(path: string, storeId: string): string {
  segment(storeId, 'Tienda');
  if (!path) return '';
  const parts = path.split('/');
  if (
    parts.length !== 5 ||
    parts[0] !== 'stores' ||
    parts[1] !== storeId ||
    parts[2] !== 'uploads' ||
    !parts[4].endsWith('.jpg')
  )
    throw new InputError('La fotografía no pertenece a esta tienda.');
  segment(parts[3], 'Propietario de foto');
  operationId(parts[4].slice(0, -4));
  return path;
}
