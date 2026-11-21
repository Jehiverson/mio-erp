/** Unit tests for callable business logic with an in-memory repository.
 * .run bypasses HTTP/AppCheck. These do not validate real Firestore transactions,
 * security rules, authorization token verification, or concurrent executions.
 */
import test, { after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-hackaton';
const { saveInventoryProduct } = await import('../lib/apps/functions/src/index.js');
const { getFirestore } = await import('firebase-admin/firestore');
const db = getFirestore();
type Data = Record<string, unknown>;
type Ref = {
  path: string;
  id: string;
  collection: (name: string) => Collection;
  get: () => Promise<ReturnType<typeof snapshot>>;
};
type Collection = { doc: (id: string) => Ref };
const docs = new Map<string, Data>();
let transactionCalls = 0;
let beforeTransaction: (() => void) | null = null;
function snapshot(path: string) {
  const value = docs.get(path);
  return {
    exists: value !== undefined,
    data: () => (value === undefined ? undefined : structuredClone(value)),
    get: (key: string) => value?.[key],
  };
}
function reference(path: string): Ref {
  return {
    path,
    id: path.split('/').at(-1)!,
    collection: (name) => collection(path + '/' + name),
    get: async () => snapshot(path),
  };
}
function collection(path: string): Collection {
  return {
    doc: (id) => {
      assert.ok(id, 'Handler must supply stable document ID');
      return reference(path + '/' + id);
    },
  };
}
const collectionMock = mock.method(db, 'collection', (name: string) => collection(name));
const transactionMock = mock.method(
  db,
  'runTransaction',
  async (callback: (tx: unknown) => Promise<unknown>) => {
    transactionCalls++;
    beforeTransaction?.();
    const writes: { kind: 'create' | 'set' | 'update'; path: string; data: Data }[] = [];
    const tx = {
      get: async (ref: Ref) => {
        assert.equal(writes.length, 0, 'Transaction must read before writing');
        return snapshot(ref.path);
      },
      create: (ref: Ref, data: Data) => {
        assert.equal(docs.has(ref.path), false, 'Create must target a missing document');
        writes.push({ kind: 'create', path: ref.path, data: structuredClone(data) });
      },
      set: (ref: Ref, data: Data) =>
        writes.push({ kind: 'set', path: ref.path, data: structuredClone(data) }),
      update: (ref: Ref, data: Data) => {
        assert.ok(docs.has(ref.path), 'Update must target an existing document');
        writes.push({ kind: 'update', path: ref.path, data: structuredClone(data) });
      },
    };
    const result = await callback(tx);
    for (const w of writes)
      docs.set(w.path, w.kind === 'update' ? { ...docs.get(w.path), ...w.data } : w.data);
    return result;
  },
);
after(() => {
  collectionMock.mock.restore();
  transactionMock.mock.restore();
});
const store = 'stores/shop_qa',
  uid = 'operator_qa',
  productPath = store + '/products/product_stable';
const product = {
  name: 'Jirafa artesanal',
  type: 'Artesanía',
  brand: '',
  size: 'Única',
  origin: 'Nacional',
  cost: 1200,
  price: 4500,
  description: 'Madera',
  photoPath: '',
};
const op1 = '123e4567-e89b-42d3-a456-426614174000',
  op2 = '123e4567-e89b-42d3-a456-426614174001';
const input = (patch: Data = {}) => ({
  storeId: 'shop_qa',
  operationId: op1,
  productId: 'product_stable',
  expectedRevision: 0,
  product: { ...product },
  ...patch,
});
const run = (data: Data, actor: string | null = uid) =>
  saveInventoryProduct.run({ data, ...(actor ? { auth: { uid: actor, token: {} } } : {}) } as never);
const code = (name: string) => (error: unknown) =>
  !!error && typeof error === 'object' && 'code' in error && error.code === name;
beforeEach(() => {
  docs.clear();
  transactionCalls = 0;
  beforeTransaction = null;
  docs.set(store + '/members/' + uid, { active: true, role: 'editor' });
});

test('save handler rechaza falta de sesión sin leer Firestore', async () => {
  const reads = collectionMock.mock.callCount();
  await assert.rejects(run(input(), null), code('unauthenticated'));
  assert.equal(collectionMock.mock.callCount(), reads);
  assert.equal(transactionCalls, 0);
});
test('save handler rechaza miembro ausente, inactivo o viewer', async () => {
  for (const member of [undefined, { active: false, role: 'admin' }, { active: true, role: 'viewer' }]) {
    if (member) docs.set(store + '/members/' + uid, member);
    else docs.delete(store + '/members/' + uid);
    await assert.rejects(run(input()), code('permission-denied'));
  }
  assert.equal(transactionCalls, 0);
  assert.equal(docs.has(productPath), false);
});
test('save handler revalida permiso dentro de transacción', async () => {
  beforeTransaction = () => docs.set(store + '/members/' + uid, { active: false, role: 'editor' });
  await assert.rejects(run(input()), code('permission-denied'));
  assert.equal(docs.has(productPath), false);
  assert.equal(docs.has(store + '/counters/products'), false);
});
test('create usa ID estable, código de servidor, revisión y contador', async () => {
  const result = await run(input());
  assert.deepEqual(result, { id: 'product_stable', code: 'A0001', revision: 1 });
  const saved = docs.get(productPath)!;
  assert.equal(saved.status, 'Disponible');
  assert.equal(saved.createdBy, uid);
  assert.equal(saved.price, 4500);
  assert.deepEqual(saved.queue, []);
  assert.equal(docs.get(store + '/counters/products')?.next, 2);
  assert.equal(docs.get(store + '/operations/' + op1)?.kind, 'inventory-save');
});
test('reintento idéntico devuelve resultado previo sin crear ni incrementar contador', async () => {
  const first = await run(input());
  const before = structuredClone([...docs]);
  const second = await run(input());
  assert.deepEqual(second, first);
  assert.deepEqual([...docs], before);
  assert.equal([...docs.keys()].filter((k) => k.includes('/products/')).length, 1);
});
test('reutilizar operación con payload u operador distinto se bloquea', async () => {
  await run(input());
  const before = structuredClone([...docs]);
  await assert.rejects(run(input({ product: { ...product, price: 5500 } })), code('already-exists'));
  assert.deepEqual([...docs], before);
  docs.set(store + '/members/another_editor', { active: true, role: 'editor' });
  await assert.rejects(run(input(), 'another_editor'), code('already-exists'));
});
test('create repetido con operación nueva e ID igual no sobrescribe producto', async () => {
  await run(input());
  const before = structuredClone([...docs]);
  await assert.rejects(run(input({ operationId: op2 })), code('already-exists'));
  assert.deepEqual([...docs], before);
});
test('edición con revisión vigente conserva código, identidad y contador', async () => {
  await run(input());
  const created = docs.get(productPath)!;
  const result = await run(
    input({
      operationId: op2,
      expectedRevision: 1,
      product: { ...product, name: 'Jirafa grande', price: 5000 },
    }),
  );
  assert.deepEqual(result, { id: 'product_stable', code: 'A0001', revision: 2 });
  const edited = docs.get(productPath)!;
  assert.equal(edited.name, 'Jirafa grande');
  assert.equal(edited.createdAt, created.createdAt);
  assert.equal(edited.createdBy, created.createdBy);
  assert.equal(edited.updatedBy, uid);
  assert.equal(docs.get(store + '/counters/products')?.next, 2);
});
test('edición obsoleta, producto vendido o inexistente no escribe', async () => {
  await run(input());
  const before = structuredClone([...docs]);
  await assert.rejects(run(input({ operationId: op2, expectedRevision: 2 })), code('aborted'));
  assert.deepEqual([...docs], before);
  docs.set(productPath, { ...docs.get(productPath), status: 'Vendido' });
  await assert.rejects(run(input({ operationId: op2, expectedRevision: 1 })), code('failed-precondition'));
  await assert.rejects(
    run(input({ operationId: op2, productId: 'missing', expectedRevision: 1 })),
    code('not-found'),
  );
});
test('ID requerido, revisión y campos de privilegio son validados antes de escribir', async () => {
  for (const patch of [
    { productId: null },
    { productId: '../otro' },
    { expectedRevision: -1 },
    { expectedRevision: 0.5 },
    { product: { ...product, status: 'Vendido' } },
  ])
    await assert.rejects(run(input(patch)), code('invalid-argument'));
  assert.equal(transactionCalls, 0);
  assert.equal(docs.has(productPath), false);
});
