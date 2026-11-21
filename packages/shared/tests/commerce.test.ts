/** Pure reducer tests; no Firebase rules, database concurrency, or provider calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCommerce,
  CommerceConflict,
  commerceDue,
  commercePaid,
  commerceTotal,
  parseCommerceCommand,
} from '../../../apps/functions/lib/packages/shared/src/commerce.js';
import { InputError } from '../../../apps/functions/lib/packages/shared/src/validation.js';
import type { CommerceCommand, CommerceState, CommerceOrder } from '../src/commerce.ts';

const now = '2026-11-21T19:00:00.000Z';
const op = () => crypto.randomUUID();
function initial(): CommerceState {
  return {
    products: [1, 2, 3, 4].map((n) => ({
      id: 'p' + n,
      code: 'A000' + n,
      name: 'Pieza ' + n,
      size: 'M',
      price: 5000,
      revision: 1,
      status: 'Disponible',
      queue: [],
      photoPath: 'photo-' + n,
    })),
    customers: [
      { id: 'c1', name: 'Andrea', contact: '@andy', address: 'Mixco' },
      { id: 'c2', name: 'Nicole', contact: '@nicole', address: 'Guatemala' },
    ],
    orders: [],
    live: { active: false, name: '', shown: [], sold: [] },
    nextOrder: 1,
  };
}
function harness() {
  let state = initial();
  return {
    get state() {
      return state;
    },
    run(command: CommerceCommand, operationId = op()) {
      const applied = applyCommerce(state, command, { operationId, now });
      state = applied.state;
      return applied.result;
    },
  };
}
type Harness = ReturnType<typeof harness>;
function start(h: Harness) {
  h.run({ kind: 'startLive', name: 'Live QA' });
}
function reserveProduct(h: Harness, pid = 'p1', cid = 'c1') {
  h.run({ kind: 'present', productId: pid });
  h.run({ kind: 'reserve', productId: pid, customerId: cid });
}
function sell(h: Harness, pid = 'p1', cid = 'c1', price = 5000) {
  reserveProduct(h, pid, cid);
  const p = h.state.products.find((p) => p.id === pid)!;
  const result = h.run({
    kind: 'confirmSale',
    productId: pid,
    customerId: cid,
    expectedRevision: p.revision,
    price,
  });
  return result.orderId!;
}
function order(h: Harness, id: string) {
  return h.state.orders.find((o) => o.id === id)!;
}
function orderCommand(h: Harness, id: string, extra: Record<string, unknown>) {
  return h.run({ ...extra, orderId: id, expectedRevision: order(h, id).revision } as CommerceCommand);
}
function plan(h: Harness, id: string, cod = false, shipping = 2500) {
  return orderCommand(h, id, {
    kind: 'planDelivery',
    address: 'Zona 4, Mixco',
    courier: 'Mensajería QA',
    date: '2026-11-23',
    guide: '',
    shipping,
    shippingCost: 1500,
    cod,
  });
}
function pay(h: Harness, id: string, value: number, method = 'Efectivo', reference = '') {
  return orderCommand(h, id, { kind: 'recordPayment', amount: value, method, reference });
}
function rejectsWithoutMutation(h: Harness, fn: () => unknown, error = InputError) {
  const before = structuredClone(h.state);
  assert.throws(fn, error);
  assert.deepEqual(h.state, before);
}

test('comercio devuelve clon independiente y no muta entrada en éxito ni error', () => {
  const source = initial(),
    before = structuredClone(source);
  const applied = applyCommerce(source, { kind: 'startLive', name: ' QA ' }, { operationId: op(), now });
  assert.deepEqual(source, before);
  assert.notEqual(applied.state, source);
  assert.equal(applied.state.live.name, 'QA');
  assert.throws(
    () => applyCommerce(source, { kind: 'present', productId: 'p1' }, { operationId: op(), now }),
    InputError,
  );
  assert.deepEqual(source, before);
});
test('contrato bloquea operaciones/campos privilegiados, montos y revisiones inválidas', () => {
  for (const command of [
    { kind: 'unknown' },
    { kind: 'startLive', name: 'QA', admin: true },
    { kind: 'confirmSale', productId: 'p1', customerId: 'c1', expectedRevision: 0, price: 100 },
    {
      kind: 'recordPayment',
      orderId: 'o1',
      expectedRevision: 1,
      amount: 1.5,
      method: 'Efectivo',
      reference: '',
    },
    {
      kind: 'recordPayment',
      orderId: 'o1',
      expectedRevision: 1,
      amount: 100,
      method: 'Tarjeta',
      reference: '',
    },
  ])
    assert.throws(() => parseCommerceCommand(command), InputError);
  assert.throws(
    () => applyCommerce(initial(), { kind: 'startLive', name: 'QA' }, { operationId: 'invalid', now }),
    InputError,
  );
});
test('live: requiere sesión al presentar, impide doble inicio y conserva reservas al finalizar', () => {
  const h = harness();
  rejectsWithoutMutation(h, () => h.run({ kind: 'present', productId: 'p1' }));
  start(h);
  rejectsWithoutMutation(h, () => h.run({ kind: 'startLive', name: 'Otra' }));
  reserveProduct(h);
  h.run({ kind: 'present', productId: 'p2' });
  h.run({ kind: 'finishLive', sessionId: h.state.live.sessionId! });
  assert.equal(h.state.products[0].status, 'Reservado');
  assert.equal(h.state.products[1].status, 'Disponible');
  assert.equal(h.state.live.active, false);
});
test('cola FIFO, cliente válido y sin duplicados; cancelación promueve al siguiente', () => {
  const h = harness();
  start(h);
  reserveProduct(h);
  h.run({ kind: 'reserve', productId: 'p1', customerId: 'c2' });
  rejectsWithoutMutation(h, () => h.run({ kind: 'reserve', productId: 'p1', customerId: 'c1' }));
  rejectsWithoutMutation(h, () => h.run({ kind: 'reserve', productId: 'p1', customerId: 'missing' }));
  const p = h.state.products[0];
  rejectsWithoutMutation(
    h,
    () =>
      h.run({
        kind: 'confirmSale',
        productId: 'p1',
        customerId: 'c2',
        expectedRevision: p.revision,
        price: 5000,
      }),
    CommerceConflict,
  );
  h.run({ kind: 'cancelReservation', productId: 'p1', customerId: 'c1' });
  const result = h.run({
    kind: 'confirmSale',
    productId: 'p1',
    customerId: 'c2',
    expectedRevision: h.state.products[0].revision,
    price: 5000,
  });
  assert.equal(order(h, result.orderId!).customerId, 'c2');
});
test('cancelar último interesado libera producto y una venta con revisión vieja se rechaza', () => {
  const h = harness();
  start(h);
  reserveProduct(h);
  const oldRevision = h.state.products[0].revision;
  h.run({ kind: 'reserve', productId: 'p1', customerId: 'c2' });
  rejectsWithoutMutation(
    h,
    () =>
      h.run({
        kind: 'confirmSale',
        productId: 'p1',
        customerId: 'c1',
        expectedRevision: oldRevision,
        price: 5000,
      }),
    CommerceConflict,
  );
  h.run({ kind: 'cancelReservation', productId: 'p1', customerId: 'c1' });
  h.run({ kind: 'cancelReservation', productId: 'p1', customerId: 'c2' });
  assert.equal(h.state.products[0].status, 'Disponible');
});
test('venta confirma sin cobrar, guarda vínculo y snapshot histórico', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  const o = order(h, oid),
    p = h.state.products[0];
  assert.equal(o.code, 'PED-0001');
  assert.equal(commercePaid(o), 0);
  assert.equal(commerceDue(o), 5000);
  assert.equal(p.soldOrderId, oid);
  assert.equal(p.status, 'Vendido');
  assert.deepEqual(o.items[0].snapshot, { name: 'Pieza 1', code: 'A0001', size: 'M', photoPath: 'photo-1' });
  rejectsWithoutMutation(
    h,
    () =>
      h.run({
        kind: 'confirmSale',
        productId: 'p1',
        customerId: 'c1',
        expectedRevision: p.revision,
        price: 5000,
      }),
    CommerceConflict,
  );
});
test('agrupa sólo pedido Pendiente de mismo cliente; despachado crea uno nuevo', () => {
  const h = harness();
  start(h);
  const first = sell(h);
  assert.equal(sell(h, 'p2'), first);
  assert.equal(order(h, first).items.length, 2);
  const other = sell(h, 'p3', 'c2');
  assert.notEqual(other, first);
  plan(h, first, true);
  orderCommand(h, first, { kind: 'shipOrder' });
  const next = sell(h, 'p4');
  assert.notEqual(next, first);
  assert.equal(order(h, first).items.length, 2);
  assert.equal(order(h, next).code, 'PED-0003');
});
test('abonos mixtos suman centavos y sólo completan saldo exacto', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  pay(h, oid, 1555);
  assert.equal(commercePaid(order(h, oid)), 1555);
  assert.equal(commerceDue(order(h, oid)), 3445);
  pay(h, oid, 3445, 'Transferencia', 'Banco QA / REF-1');
  assert.equal(commercePaid(order(h, oid)), 5000);
  assert.equal(commerceDue(order(h, oid)), 0);
  assert.equal(order(h, oid).payments[0].at, now);
});
test('pago rechaza sobrepago, transferencia sin referencia y revisión obsoleta sin mutar', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  rejectsWithoutMutation(h, () => pay(h, oid, 5001));
  rejectsWithoutMutation(h, () => pay(h, oid, 100, 'Transferencia', ' '));
  const revision = order(h, oid).revision;
  pay(h, oid, 1000);
  rejectsWithoutMutation(
    h,
    () =>
      h.run({
        kind: 'recordPayment',
        orderId: oid,
        expectedRevision: revision,
        amount: 1000,
        method: 'Efectivo',
        reference: '',
      }),
    CommerceConflict,
  );
});
test('reducer impide repetir paymentId; idempotencia global corresponde al backend', () => {
  const h = harness();
  start(h);
  const oid = sell(h),
    operationId = op();
  h.run(
    {
      kind: 'recordPayment',
      orderId: oid,
      expectedRevision: order(h, oid).revision,
      amount: 1000,
      method: 'Efectivo',
      reference: '',
    },
    operationId,
  );
  rejectsWithoutMutation(h, () =>
    h.run(
      {
        kind: 'recordPayment',
        orderId: oid,
        expectedRevision: order(h, oid).revision,
        amount: 1000,
        method: 'Efectivo',
        reference: '',
      },
      operationId,
    ),
  );
  assert.equal(order(h, oid).payments.length, 1);
});
test('envío incluye tarifa en saldo y no admite bajar total por debajo de abonado', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  plan(h, oid, false, 2500);
  assert.equal(commerceTotal(order(h, oid)), 7500);
  pay(h, oid, 7000);
  rejectsWithoutMutation(h, () => plan(h, oid, false, 1000));
  assert.equal(commerceTotal(order(h, oid)), 7500);
});
test('prepago bloquea despacho con deuda; COD permite despachar saldo pendiente', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  rejectsWithoutMutation(h, () => orderCommand(h, oid, { kind: 'shipOrder' }));
  plan(h, oid);
  rejectsWithoutMutation(h, () => orderCommand(h, oid, { kind: 'shipOrder' }));
  pay(h, oid, 7500);
  orderCommand(h, oid, { kind: 'shipOrder' });
  assert.equal(order(h, oid).status, 'Enviado');
  rejectsWithoutMutation(h, () => orderCommand(h, oid, { kind: 'shipOrder' }));
  const cod = sell(h, 'p2', 'c2');
  plan(h, cod, true);
  orderCommand(h, cod, { kind: 'shipOrder' });
  assert.equal(commerceDue(order(h, cod)), 7500);
});
test('entrega COD exige cobro exacto remanente y depósito es evento separado', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  plan(h, oid, true);
  pay(h, oid, 1000);
  orderCommand(h, oid, { kind: 'shipOrder' });
  rejectsWithoutMutation(h, () => orderCommand(h, oid, { kind: 'deliverOrder', collected: 7500 }));
  orderCommand(h, oid, { kind: 'deliverOrder', collected: 6500 });
  const delivered = order(h, oid);
  assert.equal(delivered.status, 'Entregado');
  assert.equal(commercePaid(delivered), 7500);
  assert.equal(delivered.deposited, false);
  assert.equal(delivered.payments.at(-1)?.method, 'Contraentrega');
  orderCommand(h, oid, { kind: 'reconcileDeposit', account: 'Banco QA', reference: 'DEP-1' });
  assert.equal(order(h, oid).deposited, true);
  rejectsWithoutMutation(h, () =>
    orderCommand(h, oid, { kind: 'reconcileDeposit', account: 'Banco QA', reference: 'DEP-1' }),
  );
});
test('COD pagado antes de entregar no genera cobro ni depósito fantasma', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  plan(h, oid, true);
  pay(h, oid, 7500);
  orderCommand(h, oid, { kind: 'shipOrder' });
  rejectsWithoutMutation(h, () => orderCommand(h, oid, { kind: 'deliverOrder', collected: 7500 }));
  orderCommand(h, oid, { kind: 'deliverOrder', collected: 0 });
  assert.equal(order(h, oid).payments.length, 1);
  rejectsWithoutMutation(h, () =>
    orderCommand(h, oid, { kind: 'reconcileDeposit', account: 'Banco QA', reference: 'DEP-1' }),
  );
});
test('devolución exige motivo y paquete en ruta, cancela deuda y conserva pagos', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  plan(h, oid, true);
  pay(h, oid, 1000);
  rejectsWithoutMutation(h, () => orderCommand(h, oid, { kind: 'returnOrder', reason: 'No recibido' }));
  orderCommand(h, oid, { kind: 'shipOrder' });
  rejectsWithoutMutation(h, () => orderCommand(h, oid, { kind: 'returnOrder', reason: ' ' }));
  orderCommand(h, oid, { kind: 'returnOrder', reason: 'Cliente rechazó entrega' });
  assert.equal(commerceDue(order(h, oid)), 0);
  assert.equal(commercePaid(order(h, oid)), 1000);
  assert.equal(h.state.products[0].status, 'En revisión');
  rejectsWithoutMutation(h, () => pay(h, oid, 1000));
  rejectsWithoutMutation(h, () => h.run({ kind: 'present', productId: 'p1' }));
});
test('reintegro permite reventa en otra sesión y deja pedido anterior inmutable', () => {
  const h = harness();
  start(h);
  const original = sell(h);
  plan(h, original, true);
  orderCommand(h, original, { kind: 'shipOrder' });
  orderCommand(h, original, { kind: 'returnOrder', reason: 'No recibido' });
  const historical = structuredClone(order(h, original));
  h.run({ kind: 'restock', productId: 'p1' });
  assert.equal(h.state.products[0].status, 'Disponible');
  assert.equal(h.state.products[0].soldOrderId, undefined);
  h.run({ kind: 'finishLive', sessionId: h.state.live.sessionId! });
  start(h);
  const next = sell(h);
  assert.notEqual(next, original);
  assert.deepEqual(order(h, original), historical);
  assert.equal(h.state.products[0].soldOrderId, next);
});
test('depósito exige cuenta y referencia completas', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  plan(h, oid, true);
  orderCommand(h, oid, { kind: 'shipOrder' });
  orderCommand(h, oid, { kind: 'deliverOrder', collected: 7500 });
  rejectsWithoutMutation(h, () =>
    orderCommand(h, oid, { kind: 'reconcileDeposit', account: 'Banco QA', reference: ' ' }),
  );
});
test('fecha de entrega fuera de calendario produce error validable de entrada', () => {
  const h = harness();
  start(h);
  const oid = sell(h);
  for (const date of ['2026-02-30', '2026-13-15', '2026-00-01'])
    rejectsWithoutMutation(h, () =>
      orderCommand(h, oid, {
        kind: 'planDelivery',
        address: 'Mixco',
        courier: 'QA',
        date,
        guide: '',
        shipping: 0,
        shippingCost: 0,
        cod: false,
      }),
    );
});

test('modal viejo de sesión A no puede finalizar una sesión B nueva', () => {
  const h = harness();
  start(h);
  const sessionA = h.state.live.sessionId!;
  h.run({ kind: 'finishLive', sessionId: sessionA });
  start(h);
  const sessionB = h.state.live.sessionId!;
  assert.notEqual(sessionA, sessionB);
  h.run({ kind: 'present', productId: 'p1' });
  rejectsWithoutMutation(h, () => h.run({ kind: 'finishLive', sessionId: sessionA }), CommerceConflict);
  assert.equal(h.state.live.active, true);
  assert.equal(h.state.live.sessionId, sessionB);
  assert.equal(h.state.products[0].status, 'En Live');
});
