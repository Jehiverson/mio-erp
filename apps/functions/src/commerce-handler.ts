import { createHash } from 'node:crypto';
import type { Firestore, DocumentData, DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  applyCommerce,
  canEdit,
  normalizeCustomerContact,
  segment,
  type CommerceCommand,
  type CommerceState,
  type CommerceResult,
} from '../../../packages/shared/src/index.js';

/** Targeted transactional reads: product, customer, open-order pointer and affected order.
 * Never trusts client totals, status, customer priority, timestamps or counters.
 */
export async function executeCommerceTransaction(
  db: Firestore,
  storeId: string,
  uid: string,
  opId: string,
  command: CommerceCommand,
): Promise<CommerceResult> {
  const store = db.collection('stores').doc(storeId);
  const fingerprint = createHash('sha256').update(JSON.stringify(command)).digest('hex');
  return db.runTransaction(async (tx) => {
    const snapshots = new Map<string, DocumentSnapshot>();
    const load = async (collection: string, id: string) => {
      segment(id);
      const key = `${collection}/${id}`;
      if (!snapshots.has(key)) snapshots.set(key, await tx.get(store.collection(collection).doc(id)));
      return snapshots.get(key)!;
    };
    const [member, operation] = await Promise.all([load('members', uid), load('operations', opId)]);
    if (member.get('active') !== true || !canEdit(member.get('role')))
      throw new HttpsError('permission-denied', 'Tu cuenta no puede operar en esta tienda.');
    if (operation.exists) {
      if (
        operation.get('kind') !== 'commerce' ||
        operation.get('uid') !== uid ||
        operation.get('fingerprint') !== fingerprint
      )
        throw new HttpsError('already-exists', 'Este identificador pertenece a otra operación.');
      return operation.get('result') as CommerceResult;
    }
    const live = await load('live', 'current');
    const data = live.data();
    const state: CommerceState = {
      products: [],
      customers: [],
      orders: [],
      live: data
        ? {
            active: data.active === true,
            name: data.name,
            shown: data.shown,
            sold: data.sold,
            ...(data.sessionId ? { sessionId: data.sessionId } : {}),
          }
        : { active: false, name: '', shown: [], sold: [] },
      nextOrder: 1,
    };
    if (
      !Array.isArray(state.live.shown) ||
      !Array.isArray(state.live.sold) ||
      state.live.shown.length > 200 ||
      state.live.sold.length > 200
    )
      throw new HttpsError('failed-precondition', 'La sesión live requiere revisión.');
    if ('productId' in command) await load('products', command.productId);
    if ('customerId' in command) await load('customers', command.customerId);
    let contactKey = '';
    if (command.kind === 'createCustomer') {
      contactKey = createHash('sha256').update(normalizeCustomerContact(command.contact)).digest('hex');
      const contact = await load('customerContacts', contactKey);
      if (contact.exists)
        throw new HttpsError(
          'already-exists',
          'Ya existe un cliente con este contacto. Selecciónalo en la lista.',
        );
    }
    if ('orderId' in command) await load('orders', command.orderId);
    if (command.kind === 'finishLive') await Promise.all(state.live.shown.map((id) => load('products', id)));
    if (command.kind === 'confirmSale') {
      const [pointer, counter] = await Promise.all([
        load('openOrders', command.customerId),
        load('counters', 'orders'),
      ]);
      state.nextOrder = counter.exists ? counter.get('next') : 1;
      if (pointer.exists && pointer.get('orderId')) await load('orders', segment(pointer.get('orderId')));
    }
    if (command.kind === 'returnOrder') {
      const order = snapshots.get(`orders/${command.orderId}`);
      const items = order?.get('items');
      if (order?.exists) {
        if (!Array.isArray(items) || items.length > 100)
          throw new HttpsError('failed-precondition', 'El pedido requiere revisión.');
        await Promise.all(items.map((i: { productId: string }) => load('products', segment(i.productId))));
      }
    }
    // All reads finish here; reducers validate before any write is queued.
    for (const [key, snapshot] of snapshots) {
      if (!snapshot.exists) continue;
      const value = { ...snapshot.data(), id: snapshot.id };
      if (key.startsWith('products/')) state.products.push(value as CommerceState['products'][number]);
      if (key.startsWith('customers/')) state.customers.push(value as CommerceState['customers'][number]);
      if (key.startsWith('orders/')) state.orders.push(value as CommerceState['orders'][number]);
    }
    const now = new Date().toISOString();
    const changed = applyCommerce(state, command, { operationId: opId, now });
    const writeCollection = (collection: string, before: { id: string }[], after: { id: string }[]) => {
      for (const value of after) {
        const old = before.find((x) => x.id === value.id);
        if (JSON.stringify(old) === JSON.stringify(value)) continue;
        const { id, ...body } = value as { id: string } & DocumentData;
        const oldData = snapshots.get(`${collection}/${id}`)?.data();
        const document: DocumentData = { ...oldData, ...body, updatedAt: now, updatedBy: uid };
        if (collection === 'products' && !('soldOrderId' in body)) delete document.soldOrderId;
        if (!oldData) {
          document.createdAt = now;
          document.createdBy = uid;
        }
        const reference = store.collection(collection).doc(id);
        if (oldData) tx.set(reference, document);
        else tx.create(reference, document);
      }
    };
    writeCollection('products', state.products, changed.state.products);
    writeCollection('customers', state.customers, changed.state.customers);
    writeCollection('orders', state.orders, changed.state.orders);
    if (command.kind === 'createCustomer')
      tx.create(store.collection('customerContacts').doc(contactKey), {
        customerId: command.customerId,
        createdAt: now,
      });
    if (JSON.stringify(state.live) !== JSON.stringify(changed.state.live))
      tx.set(store.collection('live').doc('current'), {
        ...changed.state.live,
        updatedAt: now,
        updatedBy: uid,
      });
    if (command.kind === 'confirmSale') {
      tx.set(store.collection('openOrders').doc(command.customerId), {
        orderId: changed.result.orderId,
        updatedAt: now,
      });
      if (changed.state.nextOrder !== state.nextOrder)
        tx.set(store.collection('counters').doc('orders'), { next: changed.state.nextOrder });
    }
    tx.create(store.collection('operations').doc(opId), {
      kind: 'commerce',
      uid,
      fingerprint,
      result: changed.result,
      commandKind: command.kind,
      at: now,
    });
    return changed.result;
  });
}
