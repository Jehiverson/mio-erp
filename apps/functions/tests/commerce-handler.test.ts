/** In-memory adapter unit tests. No Firebase rules, HTTP AppCheck or real concurrency. */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { executeCommerceTransaction } from '../lib/apps/functions/src/commerce-handler.js';
import type { CommerceCommand } from '../../../packages/shared/src/commerce.ts';
type Data = Record<string, unknown>;
type Ref = { path: string; id: string; collection: (name: string) => Collection };
type Collection = { doc: (id: string) => Ref };
const docs = new Map<string, Data>();
let reads: string[] = [];
function ref(path: string): Ref {
  return { path, id: path.split('/').at(-1)!, collection: (name) => collection(path + '/' + name) };
}
function collection(path: string): Collection {
  return {
    doc: (id) => {
      assert.ok(id);
      return ref(path + '/' + id);
    },
  };
}
function snapshot(reference: Ref) {
  const value = docs.get(reference.path);
  return {
    id: reference.id,
    exists: value !== undefined,
    data: () => (value === undefined ? undefined : structuredClone(value)),
    get: (key: string) => value?.[key],
  };
}
const db = {
  collection,
  async runTransaction(callback: (tx: unknown) => Promise<unknown>) {
    const writes: { kind: 'create' | 'set'; ref: Ref; data: Data }[] = [];
    const tx = {
      get: async (reference: Ref) => {
        assert.equal(writes.length, 0, 'All reads must precede writes');
        reads.push(reference.path);
        return snapshot(reference);
      },
      create: (reference: Ref, data: Data) => {
        assert.equal(docs.has(reference.path), false);
        writes.push({ kind: 'create', ref: reference, data: structuredClone(data) });
      },
      set: (reference: Ref, data: Data) =>
        writes.push({ kind: 'set', ref: reference, data: structuredClone(data) }),
    };
    const result = await callback(tx);
    for (const w of writes) docs.set(w.ref.path, w.data);
    return result;
  },
};
const store = 'shop_qa',
  root = 'stores/' + store,
  uid = 'operator_qa';
const productPath = (id = 'p1') => root + '/products/' + id;
const orderPath = (id: string) => root + '/orders/' + id;
const op = () => crypto.randomUUID();
const run = (command: CommerceCommand, operationId = op(), storeId = store, actor = uid) =>
  executeCommerceTransaction(db as never, storeId, actor, operationId, command);
const order = (id: string) => docs.get(orderPath(id))!;
const version = (id: string) => Number(order(id).revision);
async function sell(pid = 'p1', cid = 'c1') {
  await run({ kind: 'present', productId: pid });
  await run({ kind: 'reserve', productId: pid, customerId: cid });
  const command: CommerceCommand = {
    kind: 'confirmSale',
    productId: pid,
    customerId: cid,
    expectedRevision: Number(docs.get(productPath(pid))!.revision),
    price: 5000,
  };
  const operationId = op();
  const result = await run(command, operationId);
  return { id: result.orderId!, command, operationId, result };
}
const code = (name: string) => (error: unknown) =>
  !!error && typeof error === 'object' && 'code' in error && error.code === name;
beforeEach(() => {
  docs.clear();
  reads = [];
  docs.set(root + '/members/' + uid, { active: true, role: 'editor' });
  docs.set(root + '/live/current', { active: true, name: 'Live QA', shown: [], sold: [] });
  for (const n of [1, 2, 3])
    docs.set(productPath('p' + n), {
      code: 'A000' + n,
      name: 'Pieza ' + n,
      size: 'M',
      price: 5000,
      revision: 1,
      status: 'Disponible',
      queue: [],
      cost: 2000,
      type: 'Artesanía',
      origin: 'Nacional',
    });
  docs.set(root + '/customers/c1', { name: 'Andrea', contact: '@andy', address: 'Mixco' });
  docs.set(root + '/customers/c2', { name: 'Nicole', contact: '@nicole', address: 'Guatemala' });
});
test('adapter rechaza viewer, inactivo y acceso a otra tienda sin escrituras', async () => {
  for (const member of [
    { active: true, role: 'viewer' },
    { active: false, role: 'admin' },
  ]) {
    docs.set(root + '/members/' + uid, member);
    const before = structuredClone([...docs]);
    await assert.rejects(run({ kind: 'present', productId: 'p1' }), code('permission-denied'));
    assert.deepEqual([...docs], before);
  }
  docs.set(root + '/members/' + uid, { active: true, role: 'editor' });
  await assert.rejects(
    run({ kind: 'present', productId: 'p1' }, op(), 'other_store'),
    code('permission-denied'),
  );
});
test('venta idempotente: reintento retorna resultado original sin duplicar contador ni items', async () => {
  const sold = await sell();
  const before = structuredClone([...docs]);
  assert.deepEqual(await run(sold.command, sold.operationId), sold.result);
  assert.deepEqual([...docs], before);
  assert.equal((order(sold.id).items as unknown[]).length, 1);
  assert.equal(docs.get(root + '/counters/orders')?.next, 2);
});
test('idempotencia rechaza distinto payload, UID o tipo de operación', async () => {
  const sold = await sell();
  await assert.rejects(
    run({ ...sold.command, price: 6000 } as CommerceCommand, sold.operationId),
    code('already-exists'),
  );
  docs.set(root + '/members/other_editor', { active: true, role: 'editor' });
  await assert.rejects(run(sold.command, sold.operationId, store, 'other_editor'), code('already-exists'));
  const operationId = op();
  docs.set(root + '/operations/' + operationId, { kind: 'inventory-save', uid });
  await assert.rejects(run({ kind: 'finishLive' }, operationId), code('already-exists'));
});
test('openOrders agrupa cliente pendiente y después de envío crea nuevo pedido', async () => {
  const first = await sell();
  const same = await sell('p2');
  assert.equal(same.id, first.id);
  assert.equal((order(first.id).items as unknown[]).length, 2);
  assert.equal(docs.get(root + '/openOrders/c1')?.orderId, first.id);
  await run({
    kind: 'planDelivery',
    orderId: first.id,
    expectedRevision: version(first.id),
    address: 'Mixco',
    courier: 'QA',
    date: '2026-11-23',
    guide: '',
    shipping: 0,
    shippingCost: 0,
    cod: true,
  });
  await run({ kind: 'shipOrder', orderId: first.id, expectedRevision: version(first.id) });
  const next = await sell('p3');
  assert.notEqual(next.id, first.id);
  assert.equal(docs.get(root + '/openOrders/c1')?.orderId, next.id);
  assert.equal((order(first.id).items as unknown[]).length, 2);
});
test('venta duplicada nueva operación se bloquea y conserva pedido', async () => {
  const first = await sell();
  const before = structuredClone([...docs]);
  await assert.rejects(
    run({ ...first.command, expectedRevision: Number(docs.get(productPath())!.revision) } as CommerceCommand),
  );
  assert.deepEqual([...docs], before);
});
test('pago idempotente no duplica historial; conflicto y sobrepago no escriben', async () => {
  const sold = await sell();
  const command: CommerceCommand = {
    kind: 'recordPayment',
    orderId: sold.id,
    expectedRevision: version(sold.id),
    amount: 1000,
    method: 'Efectivo',
    reference: '',
  };
  const operationId = op();
  const first = await run(command, operationId);
  const before = structuredClone([...docs]);
  assert.deepEqual(await run(command, operationId), first);
  assert.deepEqual([...docs], before);
  await assert.rejects(run({ ...command, amount: 2000 }, operationId), code('already-exists'));
  await assert.rejects(run({ ...command, expectedRevision: version(sold.id), amount: 4001 }));
  assert.equal((order(sold.id).payments as unknown[]).length, 1);
  assert.deepEqual([...docs], before);
});
test('revisión obsoleta se rechaza sin cambiar pagos, pedido ni auditoría', async () => {
  const sold = await sell();
  const old = version(sold.id);
  await run({
    kind: 'recordPayment',
    orderId: sold.id,
    expectedRevision: old,
    amount: 1000,
    method: 'Efectivo',
    reference: '',
  });
  const before = structuredClone([...docs]);
  await assert.rejects(
    run({
      kind: 'recordPayment',
      orderId: sold.id,
      expectedRevision: old,
      amount: 1000,
      method: 'Efectivo',
      reference: '',
    }),
  );
  assert.deepEqual([...docs], before);
});
test('contacto único normalizado impide cliente nuevo con mayúsculas/espacios equivalentes', async () => {
  await run({
    kind: 'createCustomer',
    customerId: 'fresh1',
    name: 'María',
    contact: '@fresh.person',
    address: 'Mixco',
  });
  const before = structuredClone([...docs]);
  await assert.rejects(
    run({
      kind: 'createCustomer',
      customerId: 'fresh2',
      name: 'Otra persona',
      contact: '  @FRESH .PERSON  ',
      address: 'Guatemala',
    }),
  );
  assert.deepEqual([...docs], before);
  assert.equal(docs.has(root + '/customers/fresh2'), false);
});
test('adapter sólo lee documentos afectados y conserva campos de inventario al vender', async () => {
  const sold = await sell();
  assert.equal(docs.get(productPath())?.cost, 2000);
  assert.equal(docs.get(productPath())?.origin, 'Nacional');
  assert.equal(docs.get(productPath())?.soldOrderId, sold.id);
  assert.ok(reads.every((path) => path.startsWith(root + '/')));
  assert.ok(reads.some((path) => path === root + '/openOrders/c1'));
  assert.ok(reads.some((path) => path === root + '/counters/orders'));
  assert.equal(reads.includes(productPath('p3')), false);
});
