import { useState } from 'react';
import { useCommerce, CommerceFeedback } from './commerce';
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
} from '@mui/material';
import { Actions, Badge, Empty, Field, Icon, Modal, Search, Stat, useDemo } from './common';
import {
  addPayment,
  codDepositPending,
  cents,
  clientName,
  currency,
  due,
  id,
  orderTotal,
  paid,
  paymentLabel,
  ship,
  type Order,
  type Payment,
} from './model';
import { ProductPhoto } from './Inventory';
export default function Deliveries() {
  const { data, orderId, setOrderId, cloud } = useDemo();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('Todos'),
    [payFilter, setPayFilter] = useState('Todos');
  const selected = data.orders.find((o) => o.id === orderId);
  const orders = data.orders.filter(
    (o) =>
      (status === 'Todos' || o.status === status) &&
      (payFilter === 'Todos' || paymentLabel(o) === payFilter) &&
      `${o.code} ${o.customer?.name || clientName(data, o.customerId)} ${o.guide}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const uncollected = data.orders.reduce((s, o) => s + due(o), 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Entregas y pagos</h1>
          <p>Cada pedido en su lugar. Cada abono, bajo control.</p>
        </div>
        <span className="connection-note">
          <Icon name="live" size={17} />
          Conectado con ventas live
        </span>
      </div>
      <section className="stats-grid">
        <Stat
          label="Pedidos pendientes"
          value={data.orders.filter((o) => o.status === 'Pendiente').length}
          note="Por preparar y despachar"
          icon="store"
        />
        <Stat
          label="En ruta"
          value={data.orders.filter((o) => o.status === 'Enviado').length}
          note="En camino a tus clientes"
          icon="truck"
          tone="amber"
        />
        <Stat
          label="Saldo por cobrar"
          value={currency(uncollected)}
          note="Incluye saldos contraentrega"
          icon="wallet"
          tone="pink"
        />
        <Stat
          label="Entregados"
          value={data.orders.filter((o) => o.status === 'Entregado').length}
          note="Pedidos completados"
          icon="check"
          tone="green"
        />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Pedidos <span className="count-pill">{data.orders.length}</span>
            </h2>
            <p className="muted small">
              Los productos confirmados en live aparecen aquí, agrupados por cliente.
            </p>
          </div>
        </div>
        <div className="tabs" role="group" aria-label="Estado del pedido">
          {['Todos', 'Pendiente', 'Enviado', 'Entregado', 'Devuelto'].map((s) => (
            <button
              key={s}
              aria-pressed={status === s}
              className={status === s ? 'active' : ''}
              onClick={() => setStatus(s)}
            >
              {s === 'Pendiente'
                ? 'Pendientes'
                : s === 'Enviado'
                  ? 'En ruta'
                  : s === 'Entregado'
                    ? 'Entregados'
                    : s === 'Devuelto'
                      ? 'Devueltos'
                      : s}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <Search value={search} onChange={setSearch} placeholder="Buscar pedido, cliente o guía…" />
          <div className="filter-select">
            <Field
              select
              label="Estado del pago"
              value={payFilter}
              onChange={(e) => setPayFilter(e.target.value)}
            >
              {['Todos', 'Pendiente de pago', 'Pago parcial', 'Pagado', 'Reembolso pendiente'].map((x) => (
                <MenuItem value={x} key={x}>
                  {x}
                </MenuItem>
              ))}
            </Field>
          </div>
        </div>
        {cloud?.loading ? (
          <Empty title="Cargando pedidos…" description="Sincronizando entregas y pagos de la tienda." />
        ) : cloud?.error ? (
          <Empty
            title="No se pudieron sincronizar los pedidos"
            description={cloud.error}
            action={<Button onClick={cloud.onRetry}>Reintentar</Button>}
          />
        ) : orders.length ? (
          <div className="table-scroll">
            <table className="data-table orders-table">
              <thead>
                <tr>
                  <th>PEDIDO / CLIENTE</th>
                  <th>PIEZAS</th>
                  <th>TOTAL</th>
                  <th>ABONADO</th>
                  <th>SALDO</th>
                  <th>PAGO</th>
                  <th>ENTREGA</th>
                  <th>
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button className="order-cell" onClick={() => setOrderId(o.id)}>
                        <strong>{o.customer?.name || clientName(data, o.customerId)}</strong>
                        <span>
                          {o.code}
                          {o.cod ? ' · Contraentrega' : ''}
                        </span>
                      </button>
                    </td>
                    <td className="muted">{o.items.length}</td>
                    <td className="price">{currency(orderTotal(o))}</td>
                    <td className="muted">{currency(paid(o))}</td>
                    <td className={due(o) > 0 ? 'amount-due' : 'muted'}>{currency(due(o))}</td>
                    <td>
                      <Badge>{paymentLabel(o)}</Badge>
                    </td>
                    <td>
                      <Badge>{o.status}</Badge>
                    </td>
                    <td>
                      <IconButton aria-label={`Abrir ${o.code}`} onClick={() => setOrderId(o.id)}>
                        <Icon name="arrow" size={17} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No hay pedidos con estos filtros"
            description="Prueba otro estado o confirma una venta en el módulo live."
            action={
              <Button
                onClick={() => {
                  setStatus('Todos');
                  setPayFilter('Todos');
                  setSearch('');
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        )}
        <div className="pagination">
          <span className="muted small">
            {orders.length} pedidos · {cloud ? 'Tienda Firebase' : 'Datos de demostración'}
          </span>
          <span className="muted small">Los pagos se registran por pedido</span>
        </div>
      </section>
      {selected && <OrderDetail key={selected.id} order={selected} onClose={() => setOrderId(null)} />}
    </>
  );
}
function OrderDetail({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const { data, cloud } = useDemo();
  const disabled = !!cloud && (!cloud.canEdit || cloud.loading || !!cloud.error);
  const [modal, setModal] = useState<'payment' | 'plan' | 'ship' | 'deliver' | 'return' | 'deposit' | null>(
    null,
  );
  const customer = o.customer ||
    data.customers.find((c) => c.id === o.customerId) || {
      name: 'Cliente no disponible',
      contact: 'Consulta su identificador: ' + o.customerId,
    };
  const progress = o.status === 'Pendiente' ? 0 : o.status === 'Enviado' ? 1 : 2;
  return (
    <>
      <Drawer
        anchor="right"
        open
        onClose={onClose}
        PaperProps={{
          className: 'order-drawer',
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'order-title',
        }}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">DETALLE DEL PEDIDO</span>
            <h2 id="order-title">{o.code}</h2>
          </div>
          <IconButton aria-label="Cerrar pedido" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </div>
        <div className="drawer-body">
          <div className="row between">
            <Badge>{o.status}</Badge>
            <Badge>{paymentLabel(o)}</Badge>
          </div>
          <div className="customer-box">
            <Avatar sx={{ width: 43, height: 43, bgcolor: '#eee9f8', color: '#7b64b4' }}>
              {customer.name[0]}
            </Avatar>
            <div>
              <h3>{customer.name}</h3>
              <p className="muted small">{customer.contact}</p>
            </div>
          </div>
          <div className="order-progress">
            {['Pendiente', 'Enviado', o.status === 'Devuelto' ? 'Devuelto' : 'Entregado'].map((x, i) => (
              <div key={x} className={i <= progress ? 'done' : ''}>
                <span>{i < progress ? <Icon name="check" size={14} /> : i + 1}</span>
                <small>{x}</small>
              </div>
            ))}
          </div>
          <section className="order-section">
            <div className="row between">
              <h3>Resumen de pago</h3>
              {o.cod && <span className="code">Contraentrega</span>}
            </div>
            <div className="payment-summary">
              <div>
                <span>Total</span>
                <strong>{currency(orderTotal(o))}</strong>
              </div>
              <div>
                <span>Abonado</span>
                <strong>{currency(paid(o))}</strong>
              </div>
              <div className="balance">
                <span>Saldo pendiente</span>
                <strong>{currency(due(o))}</strong>
              </div>
            </div>
            {o.status === 'Devuelto' ? (
              <Alert severity="warning">
                {paid(o) > 0
                  ? `Reembolso pendiente: ${currency(paid(o))}. No se realizan reembolsos automáticos.`
                  : 'Cobro cancelado. No hay pagos que reembolsar.'}
              </Alert>
            ) : due(o) > 0 ? (
              <Button
                variant="contained"
                fullWidth
                startIcon={<Icon name="plus" />}
                disabled={disabled}
                onClick={() => setModal('payment')}
              >
                Registrar pago o abono
              </Button>
            ) : (
              <div className="paid-note">
                <Icon name="check" />
                Pedido pagado · saldo cero
              </div>
            )}
            {codDepositPending(o) && (
              <Alert
                severity="info"
                sx={{ mt: 2 }}
                action={
                  <Button disabled={disabled} color="inherit" onClick={() => setModal('deposit')}>
                    Registrar
                  </Button>
                }
              >
                Cobrado por mensajero. Depósito pendiente de conciliar.
              </Alert>
            )}
            {o.deposited && <p className="muted small">Depósito registrado: {o.depositReference}</p>}
          </section>
          <section className="order-section">
            <div className="row between">
              <h3>Productos</h3>
              <span className="muted small">{o.items.length} piezas</span>
            </div>
            {o.items.map((i) => {
              const current = data.products.find((p) => p.id === i.productId);
              const p = {
                name: i.snapshot?.name || current?.name || 'Producto ' + i.productId,
                code: i.snapshot?.code || current?.code || i.productId,
                size: i.snapshot?.size || current?.size || '',
                photo: i.snapshot && i.snapshot.photoPath !== current?.photoPath ? '' : current?.photo || '',
              };
              return (
                <div className="order-product" key={i.productId}>
                  <ProductPhoto p={p} />
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted small">
                      {p.code} · {p.size}
                    </span>
                  </div>
                  <strong>{currency(i.price)}</strong>
                </div>
              );
            })}
            <div className="row between small shipping-line">
              <span className="muted">Envío al cliente</span>
              <strong>{currency(o.shipping)}</strong>
            </div>
          </section>
          <section className="order-section">
            <div className="row between">
              <h3>Datos de entrega</h3>
              {o.status === 'Pendiente' && (
                <Button disabled={disabled} size="small" onClick={() => setModal('plan')}>
                  {o.guide ? 'Editar envío' : 'Planificar envío'}
                </Button>
              )}
            </div>
            <dl className="detail-list">
              <div>
                <dt>Dirección</dt>
                <dd>{o.address || 'Por completar'}</dd>
              </div>
              <div>
                <dt>Mensajero</dt>
                <dd>{o.courier || 'Sin asignar'}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{o.date || 'Sin programar'}</dd>
              </div>
              <div>
                <dt>Guía</dt>
                <dd>{o.guide || 'Sin generar'}</dd>
              </div>
              {o.guide && (
                <div>
                  <dt>Margen del envío</dt>
                  <dd>{currency(o.shipping - o.shippingCost)}</dd>
                </div>
              )}
            </dl>
            {o.reason && (
              <Alert severity="warning">
                Motivo de devolución: {o.reason}. Productos pendientes de inspección en Inventario.
              </Alert>
            )}
          </section>
          <section className="order-section">
            <h3>Historial de pagos</h3>
            {o.payments.length ? (
              o.payments.map((p) => (
                <div key={p.id} className="payment-event">
                  <span className="payment-event-icon">
                    <Icon name="wallet" size={17} />
                  </span>
                  <div>
                    <strong>{p.method}</strong>
                    <span className="muted small">
                      {new Date(p.at).toLocaleString('es-GT', {
                        timeZone: 'America/Guatemala',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      {p.reference ? ` · ${p.reference}` : ''}
                      {` · Recibo ${p.id}${p.operator ? ' · ' + p.operator : ''}`}
                    </span>
                  </div>
                  <strong>{currency(p.amount)}</strong>
                </div>
              ))
            ) : (
              <p className="muted small">Todavía no hay pagos registrados.</p>
            )}
          </section>
        </div>
        <div className="drawer-actions">
          {o.status === 'Pendiente' && (
            <>
              <p className="muted small">
                {due(o) > 0 && !o.cod
                  ? 'Completa el pago o define contraentrega para despachar.'
                  : 'Completa la planificación antes de despachar.'}
              </p>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Icon name="truck" />}
                disabled={disabled}
                onClick={() => setModal('ship')}
              >
                Despachar pedido
              </Button>
            </>
          )}
          {o.status === 'Enviado' && (
            <div className="row">
              <Button
                disabled={disabled}
                variant="outlined"
                color="inherit"
                onClick={() => setModal('return')}
              >
                Registrar devolución
              </Button>
              <Button
                variant="contained"
                disabled={disabled}
                onClick={() => setModal('deliver')}
                startIcon={<Icon name="check" />}
              >
                Confirmar entrega
              </Button>
            </div>
          )}
          {o.status === 'Entregado' && (
            <p className="paid-note">
              <Icon name="check" />
              Entrega completada
            </p>
          )}
          {o.status === 'Devuelto' && (
            <p className="muted small">La inspección y reintegración se realiza desde Inventario.</p>
          )}
        </div>
      </Drawer>
      {modal === 'payment' && <PaymentForm order={o} onClose={() => setModal(null)} />}{' '}
      {modal === 'plan' && <PlanForm order={o} onClose={() => setModal(null)} />}{' '}
      {modal && ['ship', 'deliver', 'return', 'deposit'].includes(modal) && (
        <CloseOrder
          order={o}
          kind={modal as 'ship' | 'deliver' | 'return' | 'deposit'}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
function PaymentForm({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const { cloud } = useDemo();
  const op = useCommerce(`payment.${o.id}`);
  const [initialRevision] = useState(
    op.pending && 'expectedRevision' in op.pending.command
      ? op.pending.command.expectedRevision
      : o.revision || 0,
  );
  const stale = !!cloud && (o.revision || 0) !== initialRevision && !op.pending;
  const locked = op.locked || op.blocked || stale;
  const close = () => {
    if (op.canClose) onClose();
  };
  const request = op.pending?.command.kind === 'recordPayment' ? op.pending.command : undefined;
  const [amount, setAmount] = useState(request ? String(request.amount / 100) : '');
  const [method, setMethod] = useState<Payment['method']>(request?.method || 'Efectivo');
  const [reference, setReference] = useState(request?.reference || '');
  const [operationId] = useState(id);
  let value: number | null = null;
  try {
    value = cents(amount);
  } catch {
    /* El campo puede estar aún incompleto. */
  }
  return (
    <Modal
      title="Registrar pago o abono"
      subtitle={`${o.code} · Registro manual de pago, sin cargo bancario automático.`}
      onClose={close}
    >
      <form
        className="form-stack"
        noValidate={!!op.pending}
        onSubmit={async (e) => {
          e.preventDefault();
          if (stale && !op.pending) return;
          if (
            await op.run(
              () => ({
                kind: 'recordPayment',
                orderId: o.id,
                expectedRevision: initialRevision,
                amount: cents(amount),
                method: method as 'Efectivo' | 'Transferencia',
                reference,
              }),
              (d) =>
                addPayment(d.orders.find((x) => x.id === o.id)!, {
                  id: operationId,
                  amount: cents(amount),
                  method,
                  reference,
                  at: new Date().toISOString(),
                }),
              'Pago registrado. El saldo fue actualizado.',
            )
          )
            onClose();
        }}
      >
        <div className="balance-preview">
          <span>Saldo actual</span>
          <strong>{currency(due(o))}</strong>
        </div>
        <div className="row between">
          <h3>Monto a registrar</h3>
          <button
            disabled={locked}
            type="button"
            className="sample-link"
            onClick={() => setAmount(String(due(o) / 100))}
          >
            Completar saldo
          </button>
        </div>
        <Field
          disabled={locked}
          autoFocus
          label="Monto del pago (Q)"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputProps={{ inputMode: 'decimal' }}
          error={value !== null && (value <= 0 || value > due(o))}
          helperText={
            value !== null && value > due(o)
              ? 'El monto supera el saldo pendiente.'
              : 'Puedes registrar el total o un abono parcial.'
          }
        />
        <Field
          disabled={locked}
          label="Método de pago"
          select
          value={method}
          onChange={(e) => setMethod(e.target.value as Payment['method'])}
        >
          {['Efectivo', 'Transferencia'].map((x) => (
            <MenuItem value={x} key={x}>
              {x}
            </MenuItem>
          ))}
        </Field>
        <Field
          disabled={locked}
          label={method === 'Transferencia' ? 'Banco / cuenta y referencia' : 'Referencia o nota (opcional)'}
          required={method === 'Transferencia'}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <div className="payment-result">
          <span>Saldo después de este pago</span>
          <strong>{value !== null && value > 0 && value <= due(o) ? currency(due(o) - value) : '—'}</strong>
        </div>
        {stale && (
          <Alert severity="warning">
            El pedido cambió. Cierra y revisa el saldo actualizado antes de registrar otro pago.
          </Alert>
        )}
        <CommerceFeedback op={op} />
        <Actions
          cancelLabel={op.pending ? 'Cerrar y verificar después' : 'Cancelar'}
          onClose={close}
          label={op.label('Confirmar pago')}
          disabled={op.busy || op.blocked || stale}
        />
      </form>
    </Modal>
  );
}
function PlanForm({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const { cloud } = useDemo();
  const op = useCommerce(`plan.${o.id}`);
  const [initialRevision] = useState(
    op.pending && 'expectedRevision' in op.pending.command
      ? op.pending.command.expectedRevision
      : o.revision || 0,
  );
  const stale = !!cloud && (o.revision || 0) !== initialRevision && !op.pending;
  const locked = op.locked || op.blocked || stale;
  const close = () => {
    if (op.canClose) onClose();
  };
  const request = op.pending?.command.kind === 'planDelivery' ? op.pending.command : undefined;
  const [address, setAddress] = useState(request?.address || o.address),
    [courier, setCourier] = useState(request?.courier || o.courier),
    [date, setDate] = useState(request?.date || o.date),
    [guide, setGuide] = useState(request?.guide || o.guide),
    [shipping, setShipping] = useState(String((request?.shipping ?? o.shipping) / 100)),
    [cost, setCost] = useState(String((request?.shippingCost ?? o.shippingCost) / 100)),
    [cod, setCod] = useState(request?.cod ?? o.cod);
  let proposedTotal: number | null = null;
  try {
    proposedTotal = o.items.reduce((sum, i) => sum + i.price, 0) + cents(shipping);
  } catch {
    /* Monto incompleto. */
  }
  return (
    <Modal
      title="Planificar envío"
      subtitle={`${o.code} · Los cambios de envío actualizan el total del pedido.`}
      onClose={close}
    >
      <form
        className="form-stack"
        noValidate={!!op.pending}
        onSubmit={async (e) => {
          e.preventDefault();
          if (stale && !op.pending) return;
          if (
            await op.run(
              () => ({
                kind: 'planDelivery',
                orderId: o.id,
                expectedRevision: initialRevision,
                address: address.trim(),
                courier: courier.trim(),
                date,
                guide: guide.trim(),
                shipping: cents(shipping),
                shippingCost: cents(cost),
                cod,
              }),
              (d) => {
                const order = d.orders.find((x) => x.id === o.id)!;
                if (order.status !== 'Pendiente') throw new Error('El pedido ya no está pendiente.');
                if (!address.trim() || !courier.trim() || !date)
                  throw new Error('Completa dirección, mensajero y fecha.');
                const fee = cents(shipping),
                  expense = cents(cost);
                if (paid(order) > order.items.reduce((s, i) => s + i.price, 0) + fee)
                  throw new Error('El nuevo total sería menor que los pagos registrados.');
                Object.assign(order, {
                  address: address.trim(),
                  courier: courier.trim(),
                  date,
                  shipping: fee,
                  shippingCost: expense,
                  cod,
                  guide: guide.trim() || `GUIA-${date.replaceAll('-', '')}-${order.code.slice(4)}`,
                });
              },
              'Envío planificado.',
            )
          )
            onClose();
        }}
      >
        <Field
          disabled={locked}
          label="Dirección de entrega"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          multiline
          minRows={2}
        />
        <div className="form-two">
          <Field
            disabled={locked}
            label="Mensajero / transportista"
            required
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
          />
          <Field
            disabled={locked}
            label="Fecha de envío"
            type="date"
            required
            InputLabelProps={{ shrink: true }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Field
          disabled={locked}
          label="Guía externa (opcional)"
          value={guide}
          onChange={(e) => setGuide(e.target.value)}
          helperText="Si la dejas vacía se genera una guía interna."
        />
        <div className="form-two">
          <Field
            disabled={locked}
            label="Cobro de envío al cliente (Q)"
            required
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            inputProps={{ inputMode: 'decimal' }}
          />
          <Field
            disabled={locked}
            label="Costo del mensajero (Q)"
            required
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputProps={{ inputMode: 'decimal' }}
          />
        </div>
        <div className="payment-summary">
          <div>
            <span>Nuevo total</span>
            <strong>{proposedTotal === null ? '—' : currency(proposedTotal)}</strong>
          </div>
          <div>
            <span>Ya abonado</span>
            <strong>{currency(paid(o))}</strong>
          </div>
          <div className="balance">
            <span>Nuevo saldo</span>
            <strong>
              {proposedTotal === null || proposedTotal < paid(o) ? '—' : currency(proposedTotal - paid(o))}
            </strong>
          </div>
        </div>
        <FormControlLabel
          control={<Checkbox disabled={locked} checked={cod} onChange={(e) => setCod(e.target.checked)} />}
          label="Cobrar saldo contraentrega"
        />
        <Alert severity="info">
          La contraentrega permite despachar con saldo pendiente. El cobro se registra al confirmar la
          entrega.
        </Alert>
        {stale && (
          <Alert severity="warning">
            El pedido cambió. Cierra esta ventana y revisa los datos antes de planificar.
          </Alert>
        )}
        <CommerceFeedback op={op} />
        <Actions
          cancelLabel={op.pending ? 'Cerrar y verificar después' : 'Cancelar'}
          onClose={close}
          label={op.label('Guardar planificación')}
          disabled={op.busy || op.blocked || stale}
        />
      </form>
    </Modal>
  );
}
function CloseOrder({
  order: o,
  kind,
  onClose,
}: {
  order: Order;
  kind: 'ship' | 'deliver' | 'return' | 'deposit';
  onClose: () => void;
}) {
  const { cloud } = useDemo();
  const op = useCommerce(`${kind}.${o.id}`);
  const [initialRevision] = useState(
    op.pending && 'expectedRevision' in op.pending.command
      ? op.pending.command.expectedRevision
      : o.revision || 0,
  );
  const stale = !!cloud && (o.revision || 0) !== initialRevision && !op.pending;
  const locked = op.locked || op.blocked || stale;
  const close = () => {
    if (op.canClose) onClose();
  };
  const request = op.pending?.command;
  const [amount, setAmount] = useState(
      String((request?.kind === 'deliverOrder' ? request.collected : due(o)) / 100),
    ),
    [reason, setReason] = useState(request?.kind === 'returnOrder' ? request.reason : ''),
    [account, setAccount] = useState(request?.kind === 'reconcileDeposit' ? request.account : ''),
    [reference, setReference] = useState(request?.kind === 'reconcileDeposit' ? request.reference : '');
  const [operationId] = useState(id);
  const title =
    kind === 'ship'
      ? 'Despachar pedido'
      : kind === 'deliver'
        ? 'Confirmar entrega'
        : kind === 'return'
          ? 'Registrar devolución'
          : 'Conciliar depósito';
  return (
    <Modal title={title} subtitle={o.code} onClose={close}>
      <form
        className="form-stack"
        noValidate={!!op.pending}
        onSubmit={async (e) => {
          e.preventDefault();
          if (stale && !op.pending) return;
          const result = await op.run(
            () =>
              kind === 'ship'
                ? { kind: 'shipOrder', orderId: o.id, expectedRevision: initialRevision }
                : kind === 'deliver'
                  ? {
                      kind: 'deliverOrder',
                      orderId: o.id,
                      expectedRevision: initialRevision,
                      collected: o.cod && due(o) > 0 ? cents(amount) : 0,
                    }
                  : kind === 'return'
                    ? {
                        kind: 'returnOrder',
                        orderId: o.id,
                        expectedRevision: initialRevision,
                        reason: reason.trim(),
                      }
                    : {
                        kind: 'reconcileDeposit',
                        orderId: o.id,
                        expectedRevision: initialRevision,
                        account: account.trim(),
                        reference: reference.trim(),
                      },
            (d) => {
              const order = d.orders.find((x) => x.id === o.id)!;
              if (kind === 'ship') {
                ship(order);
              } else if (kind === 'deliver') {
                if (order.status !== 'Enviado') throw new Error('El pedido ya no está en ruta.');
                if (order.cod && due(order) > 0) {
                  const collected = cents(amount);
                  if (collected !== due(order))
                    throw new Error('El cobro debe coincidir con el saldo pendiente.');
                  addPayment(order, {
                    id: operationId,
                    amount: collected,
                    method: 'Contraentrega',
                    reference: 'Cobro al entregar',
                    at: new Date().toISOString(),
                  });
                }
                if (due(order) !== 0) throw new Error('Completa el pago antes de entregar.');
                order.status = 'Entregado';
              } else if (kind === 'return') {
                if (order.status !== 'Enviado') throw new Error('Solo puedes devolver paquetes en ruta.');
                if (!reason.trim()) throw new Error('Indica el motivo de devolución.');
                order.status = 'Devuelto';
                order.reason = reason.trim();
                order.items.forEach((i) => {
                  d.products.find((p) => p.id === i.productId)!.status = 'En revisión';
                });
              } else {
                if (
                  order.status !== 'Entregado' ||
                  !order.cod ||
                  order.deposited ||
                  !order.payments.some((p) => p.method === 'Contraentrega' && p.amount > 0)
                )
                  throw new Error('No hay depósito pendiente.');
                if (!account.trim() || !reference.trim()) throw new Error('Indica cuenta y referencia.');
                order.deposited = true;
                order.depositReference = `${account.trim()} · ${reference.trim()}`;
              }
            },
            kind === 'ship'
              ? 'Pedido despachado.'
              : kind === 'deliver'
                ? 'Entrega confirmada.'
                : kind === 'return'
                  ? 'Devolución registrada. Productos pendientes de inspección.'
                  : 'Depósito conciliado.',
          );
          if (result) onClose();
        }}
      >
        {kind === 'ship' ? (
          <>
            <Alert severity="info">
              Confirma el despacho del paquete completo. Una compra posterior generará otro pedido.
            </Alert>
            <dl className="detail-list">
              <div>
                <dt>Guía</dt>
                <dd>{o.guide || 'Sin generar'}</dd>
              </div>
              <div>
                <dt>Mensajero</dt>
                <dd>{o.courier || 'Sin asignar'}</dd>
              </div>
              <div>
                <dt>Destino</dt>
                <dd>{o.address || 'Sin dirección'}</dd>
              </div>
              <div>
                <dt>Saldo</dt>
                <dd>
                  {currency(due(o))}
                  {o.cod ? ' · Contraentrega' : ''}
                </dd>
              </div>
            </dl>
          </>
        ) : kind === 'deliver' ? (
          <>
            <Alert severity="info">
              {o.cod && due(o) > 0
                ? 'Confirma que el mensajero entregó el paquete y cobró el saldo completo. El depósito se concilia por separado.'
                : 'Confirma que el paquete completo fue entregado al cliente.'}
            </Alert>
            {o.cod && due(o) > 0 && (
              <Field
                disabled={locked}
                label="Monto cobrado al entregar (Q)"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputProps={{ inputMode: 'decimal' }}
                helperText={`Saldo a cobrar: ${currency(due(o))}`}
              />
            )}
          </>
        ) : kind === 'return' ? (
          <>
            <Alert severity="warning">
              El saldo cobrable se cancela. Las piezas quedarán pendientes de inspección.{' '}
              {paid(o) > 0 ? `Quedará un reembolso pendiente de ${currency(paid(o))}.` : ''}
            </Alert>
            <Field
              disabled={locked}
              label="Motivo de devolución"
              required
              multiline
              minRows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </>
        ) : (
          <>
            <Alert severity="info">
              Registra manualmente el depósito del mensajero. Esta acción no consulta ni mueve dinero en el
              banco.
            </Alert>
            <div className="balance-preview">
              <span>Cobrado contraentrega</span>
              <strong>
                {currency(
                  o.payments.filter((p) => p.method === 'Contraentrega').reduce((s, p) => s + p.amount, 0),
                )}
              </strong>
            </div>
            <Field
              disabled={locked}
              label="Banco / cuenta destino"
              required
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
            <Field
              disabled={locked}
              label="Referencia de depósito"
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </>
        )}
        {stale && (
          <Alert severity="warning">
            El pedido cambió. Cierra y revisa nuevamente su estado antes de confirmar.
          </Alert>
        )}
        <CommerceFeedback op={op} />
        <Actions
          cancelLabel={op.pending ? 'Cerrar y verificar después' : 'Cancelar'}
          onClose={close}
          label={op.label(title)}
          disabled={op.busy || op.blocked || stale}
        />
      </form>
    </Modal>
  );
}
