import test from 'node:test';
import assert from 'node:assert/strict';
import {
  amount,
  canEdit,
  InputError,
  operationId,
  parseAiDraft,
  parseAnalyze,
  parseProduct,
  productCode,
  record,
  segment,
} from '../src/index.ts';

const op = '123e4567-e89b-42d3-a456-426614174000';
const product = {
  name: ' Jirafa de madera ',
  type: 'Artesanía',
  brand: '',
  size: 'Única',
  origin: 'Nacional',
  cost: 1200,
  price: 4500,
  description: 'Pieza artesanal',
  photoPath: '',
};
const draft = {
  name: 'Jirafa',
  type: 'Artesanía',
  brand: null,
  size: null,
  origin: null,
  cost: null,
  price: null,
  description: 'Madera',
};

test('contrato producto normaliza texto y exige importes enteros de centavos', () => {
  const p = parseProduct(product);
  assert.equal(p.name, 'Jirafa de madera');
  assert.equal(p.cost, 1200);
  assert.equal(p.price, 4500);
  assert.equal(parseProduct({ ...product, cost: 0 }).cost, 0);
});
test('contrato bloquea campos privilegiados, catálogos inválidos y montos incorrectos', () => {
  for (const patch of [
    { status: 'Vendido' },
    { code: 'A0001' },
    { createdBy: 'otro' },
    { name: ' ' },
    { type: 'Inventado' },
    { origin: 'Desconocido' },
    { cost: -1 },
    { price: 0 },
    { price: 1.5 },
    { cost: '1200' },
    { price: 100_000_001 },
    { name: 'x'.repeat(101) },
  ])
    assert.throws(() => parseProduct({ ...product, ...patch }), InputError);
  assert.throws(() => parseProduct({ ...product, photoPath: 'x'.repeat(401) }), InputError);
});
test('estructura y roles rechazan escalares, listas, rutas e identificadores maliciosos', () => {
  for (const x of [null, [], false, 'texto', 1]) assert.throws(() => record(x), InputError);
  assert.equal(segment('shop_1-demo'), 'shop_1-demo');
  for (const x of ['../secret', 'shop/a', '', 'x'.repeat(129), 1])
    assert.throws(() => segment(x), InputError);
  assert.equal(operationId(op), op);
  for (const x of ['id-libre', '123e4567-e89b-12d3-a456-426614174000', null])
    assert.throws(() => operationId(x), InputError);
  assert.equal(canEdit('admin'), true);
  assert.equal(canEdit('editor'), true);
  for (const x of ['viewer', 'ADMIN', null, {}]) assert.equal(canEdit(x), false);
});
test('límites monetarios incluyen cero sólo en costos', () => {
  assert.equal(amount(0, true), 0);
  assert.equal(amount(100_000_000), 100_000_000);
  for (const x of [0, -1, 1.1, NaN, Infinity, 100_000_001, '100']) assert.throws(() => amount(x), InputError);
});
test('códigos escalan sin colisiones al cambiar prefijo', () => {
  assert.equal(productCode(1), 'A0001');
  assert.equal(productCode(9999), 'A9999');
  assert.equal(productCode(10000), 'B0001');
  assert.equal(productCode(26 * 9999), 'Z9999');
  assert.equal(productCode(26 * 9999 + 1), 'AA0001');
  for (const x of [0, -1, 1.1, NaN, Infinity]) assert.throws(() => productCode(x), InputError);
});
test('solicitud IA requiere notas o JPEG acotado e identificador idempotente', () => {
  assert.deepEqual(parseAnalyze({ operationId: op, text: ' Jirafa artesanal ', image: '' }), {
    operationId: op,
    text: 'Jirafa artesanal',
    image: '',
  });
  assert.equal(parseAnalyze({ operationId: op, text: '', image: 'data:image/jpeg;base64,/9j/' }).text, '');
  for (const input of [
    { operationId: op, text: '', image: '' },
    { operationId: 'otro', text: 'algo', image: '' },
    { operationId: op, text: 'x'.repeat(4001), image: '' },
    { operationId: op, text: '', image: 'https://ejemplo.com/foto.jpg' },
    { operationId: op, text: '', image: 'data:image/png;base64,aGVsbG8=' },
    { operationId: op, text: '', image: 'data:image/jpeg;base64,' + 'A'.repeat(1_400_000) },
  ])
    assert.throws(() => parseAnalyze(input), InputError);
});
test('borrador IA conserva desconocidos como null y limpia catálogos desconocidos', () => {
  assert.deepEqual(parseAiDraft(draft), draft);
  const result = parseAiDraft({ ...draft, type: 'Zapato inventado', origin: 'Desconocido' });
  assert.equal(result.type, null);
  assert.equal(result.origin, null);
});
test('borrador IA rechaza JSON de esquema incompleto, extra o importes falsos', () => {
  const { size, ...missing } = draft;
  void size;
  for (const invalid of [
    missing,
    { ...draft, status: 'Disponible' },
    { ...draft, cost: 'Q100' },
    { ...draft, price: 0 },
    { ...draft, price: 1.25 },
    [],
    null,
  ])
    assert.throws(() => parseAiDraft(invalid), InputError);
});

test('fotografías sólo aceptan rutas de la misma tienda con propietario y operación válidos', async () => {
  const { photoPathInStore } = await import('../src/index.ts');
  assert.equal(photoPathInStore('', 'principal'), '');
  const path = `stores/principal/uploads/demo-admin/${op}.jpg`;
  assert.equal(photoPathInStore(path, 'principal'), path);
  for (const value of [
    path.replace('principal', 'otra'),
    path.replace('uploads', 'products'),
    path.replace('.jpg', '.png'),
    path + '/extra',
    '../' + path,
    path.replace(op, 'id-falso'),
  ])
    assert.throws(() => photoPathInStore(value, 'principal'), InputError);
});
