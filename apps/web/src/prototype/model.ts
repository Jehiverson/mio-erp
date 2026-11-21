// Interacciones de demostración. No sustituye las transacciones Firebase de fases posteriores.
export type ProductStatus = 'Disponible' | 'En Live' | 'Reservado' | 'Vendido' | 'En revisión';
export type Product = {
  revision?: number;
  photoPath?: string;
  id: string;
  code: string;
  name: string;
  type: string;
  brand: string;
  size: string;
  origin: string;
  cost: number;
  price: number;
  description: string;
  photo: string;
  status: ProductStatus;
  queue: string[];
};
export type Customer = { id: string; name: string; contact: string; address: string };
export type Payment = {
  id: string;
  amount: number;
  method: 'Efectivo' | 'Transferencia' | 'Contraentrega';
  reference: string;
  at: string;
};
export type Order = {
  id: string;
  code: string;
  customerId: string;
  items: { productId: string; price: number }[];
  status: 'Pendiente' | 'Enviado' | 'Entregado' | 'Devuelto';
  cod: boolean;
  payments: Payment[];
  address: string;
  courier: string;
  date: string;
  guide: string;
  shipping: number;
  shippingCost: number;
  deposited: boolean;
  depositReference: string;
  reason: string;
};
export type Demo = {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  live: { active: boolean; name: string; shown: string[]; sold: string[] };
  nextProduct: number;
  nextOrder: number;
};
export type ProductDraft = Pick<
  Product,
  'name' | 'type' | 'brand' | 'size' | 'origin' | 'description' | 'photo'
> & { cost: string; price: string };
export const emptyDraft: ProductDraft = {
  name: '',
  type: '',
  brand: '',
  size: '',
  origin: '',
  description: '',
  photo: '',
  cost: '',
  price: '',
};
export const currency = (cents: number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(cents / 100);
export const id = () => crypto.randomUUID();
export function cents(input: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(input.trim()))
    throw new Error('Ingresa un monto válido con hasta dos decimales.');
  const [whole, fraction = ''] = input.trim().split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(value)) throw new Error('El monto es demasiado grande.');
  return value;
}
export const orderTotal = (o: Order) => o.items.reduce((s, i) => s + i.price, 0) + o.shipping;
export const paid = (o: Order) => o.payments.reduce((s, p) => s + p.amount, 0);
export const due = (o: Order) => (o.status === 'Devuelto' ? 0 : Math.max(0, orderTotal(o) - paid(o)));
export const paymentLabel = (o: Order) =>
  o.status === 'Devuelto'
    ? paid(o) > 0
      ? 'Reembolso pendiente'
      : 'Cobro cancelado'
    : due(o) === 0
      ? 'Pagado'
      : paid(o) > 0
        ? 'Pago parcial'
        : 'Pendiente de pago';
export const codCollected = (o: Order) =>
  o.payments.filter((p) => p.method === 'Contraentrega').reduce((sum, p) => sum + p.amount, 0);
export const codDepositPending = (o: Order) =>
  o.status === 'Entregado' && o.cod && codCollected(o) > 0 && !o.deposited;
export const clientName = (d: Demo, cid: string) => d.customers.find((c) => c.id === cid)?.name || 'Cliente';
export function initialDemo(): Demo {
  const names = [
    'Jirafa de madera',
    'Caballo de madera',
    'Ciervo de madera',
    'Conejo de madera',
    'Gato de madera',
    'Pájaro de madera',
    'León de madera',
    'Elefante de madera',
    'Tortuga de madera',
    'Oveja de madera',
    'Perro de madera',
    'Dinosaurio de madera',
  ];
  const prices = [24500, 18500, 22500, 14500, 19500, 12500, 28500, 23500, 16500, 15500, 17500, 26500];
  const products: Product[] = names.map((name, i) => ({
    id: `p${i + 1}`,
    code: `A${String(i + 1).padStart(4, '0')}`,
    name,
    type: i % 3 === 0 ? 'Decoración' : 'Artesanía',
    brand: 'Colección natural',
    size: 'Única',
    origin: 'Nacional',
    cost: Math.round(prices[i] * 0.4),
    price: prices[i],
    description: 'Pieza artesanal de madera con acabado natural. Fotografía de ejemplo incluida en Gogo.',
    photo: `/images/products/product-${i + 1}.jpg`,
    status: i >= 7 ? 'Vendido' : 'Disponible',
    queue: [],
  }));
  const customers = [
    { id: 'c1', name: 'Andrea López', contact: '@andy.lopez', address: 'Zona 4, Mixco, Guatemala' },
    { id: 'c2', name: 'Nicole García', contact: '@nicole.g', address: 'Zona 11, Ciudad de Guatemala' },
    { id: 'c3', name: 'Luis Méndez', contact: '@luis.m', address: 'Antigua Guatemala, Sacatepéquez' },
    { id: 'c4', name: 'Gabriela Pérez', contact: '@gaby.p', address: 'Zona 7, Ciudad de Guatemala' },
  ];
  const base = {
    address: customers[0].address,
    courier: '',
    date: '',
    guide: '',
    shipping: 0,
    shippingCost: 0,
    deposited: false,
    depositReference: '',
    reason: '',
  };
  const payment = (amount: number, method: Payment['method'] = 'Efectivo'): Payment => ({
    id: id(),
    amount,
    method,
    reference: 'Ejemplo',
    at: '2026-11-21T15:00:00.000Z',
  });
  const orders: Order[] = [
    {
      ...base,
      id: 'o1',
      code: 'PED-0001',
      customerId: 'c1',
      items: [
        { productId: 'p8', price: 23500 },
        { productId: 'p9', price: 16500 },
      ],
      status: 'Pendiente',
      cod: false,
      payments: [payment(15000)],
    },
    {
      ...base,
      id: 'o2',
      code: 'PED-0002',
      customerId: 'c2',
      address: customers[1].address,
      items: [{ productId: 'p10', price: 15500 }],
      status: 'Pendiente',
      cod: false,
      payments: [],
    },
    {
      ...base,
      id: 'o3',
      code: 'PED-0003',
      customerId: 'c3',
      address: customers[2].address,
      items: [{ productId: 'p11', price: 17500 }],
      status: 'Enviado',
      cod: true,
      payments: [],
      courier: 'Mensajería local',
      date: '2026-11-21',
      guide: 'GUIA-DEMO-0003',
      shipping: 2500,
      shippingCost: 1800,
    },
    {
      ...base,
      id: 'o4',
      code: 'PED-0004',
      customerId: 'c4',
      address: customers[3].address,
      items: [{ productId: 'p12', price: 26500 }],
      status: 'Entregado',
      cod: true,
      payments: [payment(26500, 'Contraentrega')],
      courier: 'Mensajería local',
      date: '2026-11-20',
      guide: 'GUIA-DEMO-0004',
    },
  ];
  return {
    products,
    customers,
    orders,
    live: { active: false, name: 'Nueva colección · sábado', shown: [], sold: [] },
    nextProduct: 13,
    nextOrder: 5,
  };
}
export function createProduct(d: Demo, input: ProductDraft, editId?: string) {
  if (!input.name.trim() || !input.type || !input.origin)
    throw new Error('Completa nombre, tipo y procedencia.');
  const cost = cents(input.cost),
    price = cents(input.price);
  if (price <= 0) throw new Error('El precio debe ser mayor a cero.');
  const old = d.products.find((p) => p.id === editId);
  if (editId && (!old || old.status !== 'Disponible'))
    throw new Error('Solo puedes editar piezas disponibles.');
  if (old) {
    Object.assign(old, input, { name: input.name.trim(), cost, price });
    return old;
  }
  const p: Product = {
    ...input,
    name: input.name.trim(),
    cost,
    price,
    id: id(),
    code: `A${String(d.nextProduct++).padStart(4, '0')}`,
    status: 'Disponible',
    queue: [],
  };
  d.products.unshift(p);
  return p;
}
export function present(d: Demo, pid: string) {
  const p = d.products.find((p) => p.id === pid);
  if (!d.live.active || p?.status !== 'Disponible')
    throw new Error('Inicia un live y selecciona una pieza disponible.');
  p.status = 'En Live';
  if (!d.live.shown.includes(pid)) d.live.shown.push(pid);
}
export function reserve(d: Demo, pid: string, cid: string) {
  const p = d.products.find((p) => p.id === pid);
  if (!p || !['En Live', 'Reservado'].includes(p.status) || !d.customers.some((c) => c.id === cid))
    throw new Error('Selecciona un producto presentado y un cliente.');
  if (p.queue.includes(cid)) throw new Error('Este cliente ya está en la cola.');
  p.queue.push(cid);
  p.status = 'Reservado';
}
export function cancel(d: Demo, pid: string, cid: string) {
  const p = d.products.find((p) => p.id === pid);
  if (!p || p.status !== 'Reservado' || !p.queue.includes(cid)) throw new Error('No existe esta reserva.');
  p.queue = p.queue.filter((c) => c !== cid);
  if (!p.queue.length) p.status = 'Disponible';
}
export function sale(d: Demo, pid: string, price: number) {
  const p = d.products.find((p) => p.id === pid);
  if (!p || p.status !== 'Reservado' || !p.queue[0])
    throw new Error('El producto ya no tiene una reserva activa.');
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error('El precio final debe ser mayor a cero.');
  const cid = p.queue[0];
  let o = d.orders.find((o) => o.customerId === cid && o.status === 'Pendiente');
  if (!o) {
    o = {
      id: id(),
      code: `PED-${String(d.nextOrder++).padStart(4, '0')}`,
      customerId: cid,
      items: [],
      status: 'Pendiente',
      cod: false,
      payments: [],
      address: d.customers.find((c) => c.id === cid)!.address,
      courier: '',
      date: '',
      guide: '',
      shipping: 0,
      shippingCost: 0,
      deposited: false,
      depositReference: '',
      reason: '',
    };
    d.orders.unshift(o);
  }
  o.items.push({ productId: pid, price });
  p.status = 'Vendido';
  p.queue = [];
  d.live.sold.push(pid);
  return o;
}
export function addPayment(o: Order, p: Payment) {
  if (o.status === 'Devuelto') throw new Error('No se pueden registrar cobros en un pedido devuelto.');
  if (o.payments.some((x) => x.id === p.id)) return;
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0 || p.amount > due(o))
    throw new Error('El abono debe ser mayor a cero y no superar el saldo.');
  if (p.method === 'Transferencia' && !p.reference.trim())
    throw new Error('Ingresa la referencia de transferencia.');
  o.payments.push(p);
}
export function ship(o: Order) {
  if (o.status !== 'Pendiente') throw new Error('El pedido ya fue despachado.');
  if (!o.address.trim() || !o.courier.trim() || !o.date || !o.guide.trim())
    throw new Error('Completa la planificación del envío.');
  if (!o.cod && due(o) > 0)
    throw new Error('Completa el pago o selecciona contraentrega antes de despachar.');
  o.status = 'Enviado';
}
export function finishLive(d: Demo) {
  d.live.active = false;
  d.products.forEach((p) => {
    if (p.status === 'En Live') p.status = 'Disponible';
  });
}
