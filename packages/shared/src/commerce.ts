import { InputError, amount, operationId, record, segment } from './validation.js';

export type CommerceCommand =
  | { kind: 'startLive'; name: string }
  | { kind: 'finishLive'; sessionId: string }
  | { kind: 'present' | 'restock'; productId: string }
  | { kind: 'reserve' | 'cancelReservation'; productId: string; customerId: string }
  | { kind: 'confirmSale'; productId: string; customerId: string; expectedRevision: number; price: number }
  | { kind: 'createCustomer'; customerId: string; name: string; contact: string; address: string }
  | {
      kind: 'planDelivery';
      orderId: string;
      expectedRevision: number;
      address: string;
      courier: string;
      date: string;
      guide: string;
      shipping: number;
      shippingCost: number;
      cod: boolean;
    }
  | {
      kind: 'recordPayment';
      orderId: string;
      expectedRevision: number;
      amount: number;
      method: 'Efectivo' | 'Transferencia';
      reference: string;
    }
  | { kind: 'shipOrder'; orderId: string; expectedRevision: number }
  | { kind: 'deliverOrder'; orderId: string; expectedRevision: number; collected: number }
  | { kind: 'returnOrder'; orderId: string; expectedRevision: number; reason: string }
  | {
      kind: 'reconcileDeposit';
      orderId: string;
      expectedRevision: number;
      account: string;
      reference: string;
    };
export type CommerceProduct = {
  id: string;
  code: string;
  name: string;
  size: string;
  price: number;
  revision: number;
  photoPath?: string;
  status: 'Disponible' | 'En Live' | 'Reservado' | 'Vendido' | 'En revisión';
  queue: string[];
  soldOrderId?: string;
};
export type CommerceCustomer = { id: string; name: string; contact: string; address: string };
export type CommercePayment = {
  id: string;
  amount: number;
  method: 'Efectivo' | 'Transferencia' | 'Contraentrega';
  reference: string;
  at: string;
};
export type CommerceOrder = {
  id: string;
  code: string;
  customerId: string;
  revision: number;
  customer?: { name: string; contact: string };
  items: {
    productId: string;
    price: number;
    snapshot?: { name: string; code: string; size: string; photoPath: string };
  }[];
  status: 'Pendiente' | 'Enviado' | 'Entregado' | 'Devuelto';
  cod: boolean;
  payments: CommercePayment[];
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
export type CommerceState = {
  products: CommerceProduct[];
  customers: CommerceCustomer[];
  orders: CommerceOrder[];
  live: { active: boolean; name: string; shown: string[]; sold: string[]; sessionId?: string };
  nextOrder: number;
};
export type CommerceResult = { orderId?: string; customerId?: string; revision?: number };
export class CommerceConflict extends InputError {}
export const normalizeCustomerContact = (contact: string) =>
  contact.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');
const fields: Record<CommerceCommand['kind'], string[]> = {
  startLive: ['name'],
  finishLive: ['sessionId'],
  present: ['productId'],
  restock: ['productId'],
  reserve: ['productId', 'customerId'],
  cancelReservation: ['productId', 'customerId'],
  confirmSale: ['productId', 'customerId', 'expectedRevision', 'price'],
  createCustomer: ['customerId', 'name', 'contact', 'address'],
  planDelivery: [
    'orderId',
    'expectedRevision',
    'address',
    'courier',
    'date',
    'guide',
    'shipping',
    'shippingCost',
    'cod',
  ],
  recordPayment: ['orderId', 'expectedRevision', 'amount', 'method', 'reference'],
  shipOrder: ['orderId', 'expectedRevision'],
  deliverOrder: ['orderId', 'expectedRevision', 'collected'],
  returnOrder: ['orderId', 'expectedRevision', 'reason'],
  reconcileDeposit: ['orderId', 'expectedRevision', 'account', 'reference'],
};
function text(v: unknown, label: string, max: number, required = true) {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    throw new InputError(`${label}: completa un texto válido.`);
  return v.trim();
}
function revision(v: unknown) {
  if (!Number.isSafeInteger(v) || Number(v) < 1) throw new InputError('Versión no válida.');
  return Number(v);
}
export function parseCommerceCommand(value: unknown): CommerceCommand {
  const v = record(value);
  if (typeof v.kind !== 'string' || !Object.hasOwn(fields, v.kind))
    throw new InputError('Operación no válida.');
  const kind = v.kind as CommerceCommand['kind'];
  if (Object.keys(v).some((k) => k !== 'kind' && !fields[kind].includes(k)))
    throw new InputError('La operación contiene campos no permitidos.');
  const c: Record<string, unknown> = { kind };
  for (const key of fields[kind]) {
    if (key === 'productId' || key === 'customerId' || key === 'orderId' || key === 'sessionId')
      c[key] = segment(v[key], key);
    else if (key === 'expectedRevision') c[key] = revision(v[key]);
    else if (['price', 'amount', 'shipping', 'shippingCost', 'collected'].includes(key))
      c[key] = amount(v[key], !['price', 'amount'].includes(key));
    else if (key === 'cod') {
      if (typeof v[key] !== 'boolean') throw new InputError('Selecciona la modalidad de cobro.');
      c[key] = v[key];
    } else if (key === 'method') {
      if (!['Efectivo', 'Transferencia'].includes(String(v[key])))
        throw new InputError('Método de pago no válido.');
      c[key] = v[key];
    } else
      c[key] = text(
        v[key],
        key,
        key === 'address' || key === 'reason' ? 1000 : 160,
        !['address', 'guide', 'reference'].includes(key),
      );
  }
  return c as CommerceCommand;
}
export const commerceTotal = (o: CommerceOrder) => o.items.reduce((s, i) => s + i.price, 0) + o.shipping;
export const commercePaid = (o: CommerceOrder) => o.payments.reduce((s, p) => s + p.amount, 0);
export const commerceDue = (o: CommerceOrder) =>
  o.status === 'Devuelto' ? 0 : commerceTotal(o) - commercePaid(o);
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InputError(message);
}
export function applyCommerce(
  source: CommerceState,
  input: CommerceCommand,
  context: { operationId: string; now: string },
): { state: CommerceState; result: CommerceResult } {
  const command = parseCommerceCommand(input);
  operationId(context.operationId);
  const state = structuredClone(source),
    result: CommerceResult = {};
  const product = 'productId' in command ? state.products.find((p) => p.id === command.productId) : undefined;
  if ('productId' in command) ensure(product, 'Producto no encontrado.');
  const order = 'orderId' in command ? state.orders.find((o) => o.id === command.orderId) : undefined;
  if ('orderId' in command) {
    ensure(order, 'Pedido no encontrado.');
    if (order.revision !== command.expectedRevision)
      throw new CommerceConflict('El pedido cambió. Cierra y vuelve a abrir el detalle.');
  }
  const pushPayment = (
    o: CommerceOrder,
    value: number,
    method: CommercePayment['method'],
    reference: string,
  ) => {
    ensure(o.status !== 'Devuelto', 'No puedes cobrar un pedido devuelto.');
    ensure(o.payments.length < 200, 'El pedido alcanzó el límite de 200 pagos del MVP.');
    amount(value);
    ensure(value <= commerceDue(o), 'El pago no puede superar el saldo pendiente.');
    ensure(method !== 'Transferencia' || reference.trim(), 'Ingresa la referencia de transferencia.');
    ensure(!o.payments.some((p) => p.id === context.operationId), 'Esta operación de pago ya existe.');
    o.payments.push({ id: context.operationId, amount: value, method, reference, at: context.now });
  };
  switch (command.kind) {
    case 'startLive':
      ensure(!state.live.active, 'Ya hay un live en curso.');
      state.live = { active: true, name: command.name, shown: [], sold: [], sessionId: context.operationId };
      break;
    case 'finishLive':
      if (state.live.sessionId !== command.sessionId)
        throw new CommerceConflict('La sesión live cambió. Revisa la sesión actual antes de finalizar.');
      ensure(state.live.active, 'No hay un live en curso.');
      state.live.active = false;
      state.products.forEach((p) => {
        if (p.status === 'En Live') {
          p.status = 'Disponible';
          p.revision++;
        }
      });
      break;
    case 'createCustomer':
      ensure(!state.customers.some((c) => c.id === command.customerId), 'El cliente ya existe.');
      ensure(
        !state.customers.some(
          (c) => normalizeCustomerContact(c.contact) === normalizeCustomerContact(command.contact),
        ),
        'Ya existe un cliente con este contacto.',
      );
      state.customers.push({
        id: command.customerId,
        name: command.name,
        contact: command.contact,
        address: command.address,
      });
      result.customerId = command.customerId;
      break;
    case 'present':
      ensure(
        state.live.active && product!.status === 'Disponible',
        'Inicia un live y selecciona una pieza disponible.',
      );
      ensure(
        state.live.shown.includes(product!.id) || state.live.shown.length < 200,
        'La sesión alcanzó el límite de 200 piezas del MVP.',
      );
      product!.status = 'En Live';
      product!.revision++;
      if (!state.live.shown.includes(product!.id)) state.live.shown.push(product!.id);
      break;
    case 'reserve':
      ensure(['En Live', 'Reservado'].includes(product!.status), 'Presenta el producto antes de reservar.');
      ensure(
        state.customers.some((c) => c.id === command.customerId),
        'Selecciona un cliente existente.',
      );
      ensure(!product!.queue.includes(command.customerId), 'El cliente ya está en la cola.');
      ensure(product!.queue.length < 100, 'La cola alcanzó su límite de 100 interesados.');
      product!.queue.push(command.customerId);
      product!.status = 'Reservado';
      product!.revision++;
      break;
    case 'cancelReservation':
      ensure(
        product!.status === 'Reservado' && product!.queue.includes(command.customerId),
        'La reserva ya no existe.',
      );
      product!.queue = product!.queue.filter((c) => c !== command.customerId);
      if (!product!.queue.length) product!.status = 'Disponible';
      product!.revision++;
      break;
    case 'confirmSale': {
      if (product!.revision !== command.expectedRevision || product!.queue[0] !== command.customerId)
        throw new CommerceConflict('La reserva cambió. Revisa el comprador antes de confirmar.');
      ensure(product!.status === 'Reservado', 'El producto ya no tiene reserva activa.');
      ensure(!state.live.sold.includes(product!.id), 'Esta pieza ya fue vendida en la sesión.');
      ensure(state.live.sold.length < 200, 'La sesión alcanzó el límite de 200 ventas del MVP.');
      const customer = state.customers.find((c) => c.id === command.customerId);
      ensure(customer, 'Cliente no encontrado.');
      let target = state.orders.find((o) => o.customerId === customer.id && o.status === 'Pendiente');
      if (!target) {
        ensure(
          Number.isSafeInteger(state.nextOrder) && state.nextOrder > 0,
          'Secuencia de pedidos no válida.',
        );
        target = {
          id: `order_${context.operationId}`,
          code: `PED-${String(state.nextOrder++).padStart(4, '0')}`,
          customerId: customer.id,
          customer: { name: customer.name, contact: customer.contact },
          revision: 0,
          items: [],
          status: 'Pendiente',
          cod: false,
          payments: [],
          address: customer.address,
          courier: '',
          date: '',
          guide: '',
          shipping: 0,
          shippingCost: 0,
          deposited: false,
          depositReference: '',
          reason: '',
        };
        state.orders.unshift(target);
      }
      ensure(
        target.items.length < 100 && !target.items.some((i) => i.productId === product!.id),
        'El pedido no admite más piezas o la pieza ya está agregada.',
      );
      ensure(commerceTotal(target) + command.price <= 100_000_000, 'El total supera el límite del MVP.');
      target.items.push({
        productId: product!.id,
        price: command.price,
        snapshot: {
          name: product!.name,
          code: product!.code,
          size: product!.size,
          photoPath: product!.photoPath || '',
        },
      });
      target.revision++;
      product!.status = 'Vendido';
      product!.queue = [];
      product!.soldOrderId = target.id;
      product!.revision++;
      state.live.sold.push(product!.id);
      result.orderId = target.id;
      result.revision = target.revision;
      break;
    }
    case 'planDelivery': {
      ensure(order!.status === 'Pendiente', 'Sólo puedes planificar pedidos pendientes.');
      ensure(command.address && command.courier, 'Completa dirección y mensajero.');
      const date = new Date(`${command.date}T00:00:00Z`);
      ensure(
        /^\d{4}-\d{2}-\d{2}$/.test(command.date) &&
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === command.date,
        'Fecha de envío no válida.',
      );
      const total = order!.items.reduce((s, i) => s + i.price, 0) + command.shipping;
      ensure(
        total <= 100_000_000 && total >= commercePaid(order!),
        'El nuevo total no puede ser menor que los pagos ni superar el límite.',
      );
      Object.assign(order!, {
        address: command.address,
        courier: command.courier,
        date: command.date,
        guide: command.guide || `GUIA-${order!.code}`,
        shipping: command.shipping,
        shippingCost: command.shippingCost,
        cod: command.cod,
      });
      break;
    }
    case 'recordPayment':
      pushPayment(order!, command.amount, command.method, command.reference);
      break;
    case 'shipOrder':
      ensure(order!.status === 'Pendiente', 'El pedido ya fue despachado.');
      ensure(
        order!.address && order!.courier && order!.date && order!.guide,
        'Completa la planificación antes de despachar.',
      );
      ensure(
        order!.cod || commerceDue(order!) === 0,
        'Completa el pago o define contraentrega antes de despachar.',
      );
      order!.status = 'Enviado';
      break;
    case 'deliverOrder': {
      ensure(order!.status === 'Enviado', 'El pedido ya no está en ruta.');
      const pending = commerceDue(order!);
      if (order!.cod && pending > 0) {
        ensure(command.collected === pending, 'El cobro debe coincidir con el saldo pendiente.');
        pushPayment(order!, command.collected, 'Contraentrega', 'Cobro al entregar');
      } else ensure(command.collected === 0, 'Este pedido no tiene saldo contraentrega que cobrar.');
      ensure(commerceDue(order!) === 0, 'Completa el pago antes de entregar.');
      order!.status = 'Entregado';
      break;
    }
    case 'returnOrder':
      ensure(order!.status === 'Enviado', 'Sólo puedes devolver paquetes en ruta.');
      order!.status = 'Devuelto';
      order!.reason = command.reason;
      for (const item of order!.items) {
        const p = state.products.find((p) => p.id === item.productId);
        ensure(
          p && p.status === 'Vendido' && p.soldOrderId === order!.id,
          'La pieza ya no pertenece a este pedido.',
        );
        p.status = 'En revisión';
        p.revision++;
      }
      break;
    case 'reconcileDeposit':
      ensure(command.account.trim() && command.reference.trim(), 'Indica cuenta y referencia del depósito.');
      ensure(
        order!.status === 'Entregado' &&
          order!.cod &&
          !order!.deposited &&
          order!.payments.some((p) => p.method === 'Contraentrega' && p.amount > 0),
        'No hay depósito pendiente.',
      );
      order!.deposited = true;
      order!.depositReference = `${command.account} · ${command.reference}`;
      break;
    case 'restock':
      ensure(
        product!.status === 'En revisión',
        'Sólo puedes reintegrar una pieza inspeccionada en revisión.',
      );
      product!.status = 'Disponible';
      product!.queue = [];
      delete product!.soldOrderId;
      product!.revision++;
      break;
  }
  if (order) {
    order.revision++;
    result.orderId = order.id;
    result.revision = order.revision;
  }
  return { state, result };
}
