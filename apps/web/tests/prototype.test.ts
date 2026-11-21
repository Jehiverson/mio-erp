import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPayment,
  cancel,
  cents,
  createProduct,
  due,
  emptyDraft,
  finishLive,
  initialDemo,
  orderTotal,
  paid,
  paymentLabel,
  present,
  reserve,
  sale,
  ship,
} from '../src/prototype/model.ts';
import type { Demo, Order, Payment, ProductDraft } from '../src/prototype/model.ts';

const draft: ProductDraft = {
  ...emptyDraft,
  name: 'Blusa de prueba',
  type: 'Blusa',
  origin: 'Segunda mano',
  cost: '15.25',
  price: '50.75',
};
const setup = () => {
  const d = initialDemo();
  d.live.active = true;
  return d;
};
function sell(d: Demo, pid = 'p1', cid = 'c4', price = 5000) {
  present(d, pid);
  reserve(d, pid, cid);
  return sale(d, pid, price);
}
function payment(
  amount: number,
  operation = 'pay-1',
  method: Payment['method'] = 'Efectivo',
  reference = '',
): Payment {
  return { id: operation, amount, method, reference, at: '2026-11-21T16:00:00Z' };
}
function plan(o: Order) {
  o.address = 'Zona 4, Mixco';
  o.courier = 'Mensajería QA';
  o.date = '2026-11-23';
  o.guide = 'GUIA-QA';
  o.shipping = 2500;
}

test('centavos exactos: suma, cero, espacios y dos decimales', () => {
  assert.equal(cents('0'), 0);
  assert.equal(cents(' 15.25 '), 1525);
  assert.equal(cents('10.5'), 1050);
  assert.equal(cents('0.10') + cents('0.20'), 30);
  assert.equal(cents('0002.01'), 201);
});
test('montos inválidos y precisión de más de dos decimales se rechazan', () => {
  for (const input of [
    '',
    ' ',
    '-1',
    '1.001',
    '1e3',
    'NaN',
    'Infinity',
    '1,25',
    '.50',
    '1.',
    '9007199254740992',
  ])
    assert.throws(() => cents(input), undefined, input);
});
test('alta manual almacena enteros, código consecutivo y estado disponible', () => {
  const d = initialDemo();
  const p = createProduct(d, { ...draft, name: ' Blusa de prueba ' });
  assert.equal(p.price, 5075);
  assert.equal(p.cost, 1525);
  assert.equal(p.name, 'Blusa de prueba');
  assert.equal(p.code, 'A0013');
  assert.equal(p.status, 'Disponible');
  assert.deepEqual(p.queue, []);
  assert.equal(d.products[0].id, p.id);
  assert.equal(createProduct(d, draft).code, 'A0014');
});
test('alta inválida no modifica inventario ni consume códigos', () => {
  for (const patch of [
    { name: '' },
    { type: '' },
    { origin: '' },
    { cost: '-1' },
    { price: '0' },
    { price: '0.335' },
  ]) {
    const d = initialDemo(),
      before = structuredClone(d);
    assert.throws(() => createProduct(d, { ...draft, ...patch }));
    assert.deepEqual(d, before);
  }
});
test('edición conserva identidad/código y sólo permite piezas disponibles', () => {
  const d = initialDemo(),
    p = d.products[0],
    code = p.code;
  createProduct(d, { ...draft, name: 'Nuevo nombre' }, p.id);
  assert.equal(p.code, code);
  assert.equal(p.name, 'Nuevo nombre');
  d.live.active = true;
  present(d, p.id);
  assert.throws(() => createProduct(d, draft, p.id));
  assert.throws(() => createProduct(d, draft, 'inexistente'));
});
test('presentación exige live activo y disponibilidad', () => {
  const d = initialDemo();
  assert.throws(() => present(d, 'p1'));
  d.live.active = true;
  present(d, 'p1');
  assert.equal(d.products[0].status, 'En Live');
  assert.throws(() => present(d, 'p1'));
  assert.throws(() => present(d, 'p8'));
  assert.deepEqual(d.live.shown, ['p1']);
});
test('cola valida cliente y duplicados, cancelación promueve al siguiente', () => {
  const d = setup();
  present(d, 'p1');
  assert.throws(() => reserve(d, 'p1', 'missing'));
  reserve(d, 'p1', 'c1');
  reserve(d, 'p1', 'c2');
  assert.throws(() => reserve(d, 'p1', 'c1'));
  assert.deepEqual(d.products[0].queue, ['c1', 'c2']);
  cancel(d, 'p1', 'c1');
  const o = sale(d, 'p1', 5000);
  assert.equal(o.customerId, 'c2');
  assert.equal(d.products[0].status, 'Vendido');
  assert.deepEqual(d.products[0].queue, []);
});
test('cancelar último interesado libera pieza; finalizar live conserva reservas', () => {
  const d = setup();
  present(d, 'p1');
  present(d, 'p2');
  reserve(d, 'p2', 'c1');
  finishLive(d);
  assert.equal(d.live.active, false);
  assert.equal(d.products[0].status, 'Disponible');
  assert.equal(d.products[1].status, 'Reservado');
  cancel(d, 'p2', 'c1');
  assert.equal(d.products[1].status, 'Disponible');
});
test('venta requiere reserva y precio entero positivo; doble venta no muta estado', () => {
  const d = setup();
  assert.throws(() => sale(d, 'p1', 5000));
  present(d, 'p1');
  reserve(d, 'p1', 'c4');
  for (const n of [0, -1, 0.335, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => sale(d, 'p1', n));
  sale(d, 'p1', 5000);
  const before = structuredClone(d);
  assert.throws(() => sale(d, 'p1', 5000));
  assert.throws(() => reserve(d, 'p1', 'c2'));
  assert.deepEqual(d, before);
});
test('confirmar venta no marca pagado; agrupa pedido pendiente', () => {
  const d = setup();
  const o = sell(d);
  assert.equal(o.code, 'PED-0005');
  assert.equal(paid(o), 0);
  assert.equal(due(o), 5000);
  assert.equal(paymentLabel(o), 'Pendiente de pago');
  assert.equal(o.payments.length, 0);
  const same = sell(d, 'p2', 'c4', 7500);
  assert.equal(same.id, o.id);
  assert.equal(o.items.length, 2);
  assert.equal(orderTotal(o), 12500);
});
test('pedido enviado deja de agrupar compras posteriores del cliente', () => {
  const d = setup();
  const o = sell(d);
  plan(o);
  o.cod = true;
  ship(o);
  const next = sell(d, 'p2');
  assert.notEqual(next.id, o.id);
  assert.equal(next.code, 'PED-0006');
  assert.equal(o.items.length, 1);
  assert.equal(next.items.length, 1);
});
test('abonos mixtos son parciales y reintentar mismo identificador no duplica', () => {
  const d = setup();
  const o = sell(d);
  addPayment(o, payment(1000));
  assert.equal(paid(o), 1000);
  assert.equal(due(o), 4000);
  assert.equal(paymentLabel(o), 'Pago parcial');
  addPayment(o, payment(1000));
  assert.equal(o.payments.length, 1);
  addPayment(o, payment(4000, 'pay-2', 'Transferencia', 'Banco QA / REF-1'));
  assert.equal(paid(o), 5000);
  assert.equal(due(o), 0);
  assert.equal(paymentLabel(o), 'Pagado');
  addPayment(o, payment(4000, 'pay-2', 'Transferencia', 'Banco QA / REF-1'));
  assert.equal(o.payments.length, 2);
});
test('pago inválido, sobrepago y transferencia sin referencia no cambian historial', () => {
  const d = setup(),
    o = sell(d);
  for (const amount of [0, -1, 5001, 1.5, NaN, Infinity]) assert.throws(() => addPayment(o, payment(amount)));
  assert.throws(() => addPayment(o, payment(1000, 'p2', 'Transferencia', ' ')));
  assert.equal(o.payments.length, 0);
});
test('despacho requiere planificación y saldo cero salvo contraentrega', () => {
  const d = setup(),
    o = sell(d);
  assert.throws(() => ship(o));
  plan(o);
  assert.throws(() => ship(o));
  addPayment(o, payment(5000));
  assert.equal(due(o), 2500);
  assert.throws(() => ship(o));
  addPayment(o, payment(2500, 'ship-payment'));
  ship(o);
  assert.equal(o.status, 'Enviado');
  assert.throws(() => ship(o));
  const cod = sell(d, 'p2', 'c3');
  plan(cod);
  cod.cod = true;
  ship(cod);
  assert.equal(cod.status, 'Enviado');
  assert.equal(due(cod), 7500);
  assert.equal(paid(cod), 0);
});
test('devolución conserva historial, cancela deuda y bloquea nuevos cobros', () => {
  const d = setup(),
    o = sell(d);
  addPayment(o, payment(1000));
  o.status = 'Devuelto';
  assert.equal(due(o), 0);
  assert.equal(paid(o), 1000);
  assert.equal(paymentLabel(o), 'Reembolso pendiente');
  assert.throws(() => addPayment(o, payment(1000, 'next')));
  assert.equal(o.payments.length, 1);
  const unpaid = sell(d, 'p2', 'c3');
  unpaid.status = 'Devuelto';
  assert.equal(paymentLabel(unpaid), 'Cobro cancelado');
});
test('datos demo serializan pedidos/pagos/reservas sin pérdida', () => {
  const d = setup();
  sell(d);
  present(d, 'p2');
  reserve(d, 'p2', 'c2');
  assert.deepEqual(JSON.parse(JSON.stringify(d)), d);
});

// Regresión: COD pagado antes de la entrega no implica cobro del mensajero.
test('depósito COD requiere cobro real del mensajero, no sólo modalidad COD', async () => {
  const { codDepositPending } = await import('../src/prototype/model.ts');
  const d = initialDemo();
  const o = d.orders.find((o) => o.id === 'o3')!;
  addPayment(o, {
    id: 'prepago',
    amount: due(o),
    method: 'Efectivo',
    reference: '',
    at: new Date().toISOString(),
  });
  o.status = 'Entregado';
  assert.equal(codDepositPending(o), false);
  const collected = d.orders.find((o) => o.id === 'o4')!;
  assert.equal(codDepositPending(collected), true);
  collected.deposited = true;
  assert.equal(codDepositPending(collected), false);
});

test('galería conserva fotos al guardar y recargar; cambiar portada y quitar una no afecta identidad', () => {
  const d = initialDemo();
  const photos = ['data:image/jpeg;base64,YQ==', 'data:image/jpeg;base64,Yg==', 'data:image/jpeg;base64,Yw=='];
  const p = createProduct(d, { ...draft, photo: photos[0], photos });
  const restored = JSON.parse(JSON.stringify(d)) as Demo;
  assert.deepEqual(restored.products[0].photos, photos);
  createProduct(restored, { ...draft, photo: photos[2], photos: [photos[2], photos[0]] }, p.id);
  assert.equal(restored.products[0].photo, photos[2]);
  assert.deepEqual(restored.products[0].photos, [photos[2], photos[0]]);
  assert.equal(restored.products[0].code, p.code);
  assert.equal(restored.nextProduct, d.nextProduct);
});
