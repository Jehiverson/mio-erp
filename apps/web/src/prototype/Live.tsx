import { useState, type FormEvent } from 'react';
import { Alert, Avatar, Button, MenuItem } from '@mui/material';
import { Actions, Badge, Empty, Field, Icon, Modal, Search, Stat, useDemo } from './common';
import {
  cancel,
  cents,
  clientName,
  currency,
  finishLive,
  id,
  present,
  reserve,
  sale,
  type Product,
} from './model';
import { ProductPhoto } from './Inventory';
export default function Live() {
  const { data, act, go } = useDemo();
  const [selected, setSelected] = useState(
    data.products.find((p) => ['En Live', 'Reservado'].includes(p.status))?.id ||
      data.products.find((p) => p.status === 'Disponible')?.id ||
      '',
  );
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('c1');
  const [session, setSession] = useState(false);
  const [ending, setEnding] = useState(false);
  const [name, setName] = useState(data.live.name);
  const [confirm, setConfirm] = useState<Product | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [lastOrder, setLastOrder] = useState<string | null>(null);
  const products = data.products.filter(
    (p) =>
      ['Disponible', 'En Live', 'Reservado'].includes(p.status) &&
      `${p.name} ${p.code}`.toLowerCase().includes(search.toLowerCase()),
  );
  const p = data.products.find((p) => p.id === selected);
  const soldAmount = data.orders
    .flatMap((o) => o.items)
    .filter((i) => data.live.sold.includes(i.productId))
    .reduce((s, i) => s + i.price, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Ventas live{' '}
            <span className={`session-label ${data.live.active ? 'on' : ''}`}>
              <span />
              {data.live.active ? 'En curso' : 'Sin iniciar'}
            </span>
          </h1>
          <p>Presenta, reserva y convierte cada interesado en un pedido.</p>
        </div>
        {data.live.active ? (
          <Button variant="outlined" color="inherit" onClick={() => setEnding(true)}>
            Finalizar live
          </Button>
        ) : (
          <Button variant="contained" startIcon={<Icon name="live" />} onClick={() => setSession(true)}>
            Iniciar live
          </Button>
        )}
      </div>
      <section className="stats-grid three">
        <Stat
          label="Productos presentados"
          value={data.live.shown.length}
          note="En la sesión actual"
          icon="live"
        />
        <Stat
          label="Reservas activas"
          value={data.products.filter((p) => p.status === 'Reservado').length}
          note="Esperando confirmación"
          icon="users"
          tone="amber"
        />
        <Stat
          label="Ventas confirmadas"
          value={currency(soldAmount)}
          note={`${data.live.sold.length} piezas en esta sesión · no implica cobro`}
          icon="wallet"
          tone="green"
        />
      </section>
      {lastOrder && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" onClick={() => go('entregas', lastOrder)}>
              Ver pedido
            </Button>
          }
        >
          Venta confirmada. El pedido ya está disponible en Entregas.
        </Alert>
      )}
      <div className="live-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{data.live.name}</h2>
              <p className="muted small">Panel operativo · la transmisión se realiza en tu red social.</p>
            </div>
            <Badge tone={data.live.active ? 'red' : 'gray'}>
              {data.live.active ? 'LIVE' : 'PREPARACIÓN'}
            </Badge>
          </div>
          <div className="live-feature">
            {p && p.status !== 'Vendido' ? (
              <>
                <div className="feature-photo">
                  <ProductPhoto p={p} />
                  <span className="floating-code">{p.code}</span>
                </div>
                <div className="feature-info">
                  <Badge>{p.status}</Badge>
                  <h2>{p.name}</h2>
                  <p className="muted">
                    {p.brand} · {p.size}
                  </p>
                  <strong className="feature-price">{currency(p.price)}</strong>
                  {p.status === 'Disponible' ? (
                    <Button
                      variant="contained"
                      fullWidth
                      disabled={!data.live.active}
                      onClick={() =>
                        act((d) => present(d, p.id), 'Producto presentado. Ya puedes agregar interesados.')
                      }
                      startIcon={<Icon name="live" />}
                    >
                      Presentar producto
                    </Button>
                  ) : (
                    <div className="presented-note">
                      <Icon name="check" />
                      Producto presentado · listo para reservar
                    </div>
                  )}
                  {!data.live.active && p.status === 'Disponible' && (
                    <p className="muted small">Inicia el live para presentar este producto.</p>
                  )}
                </div>
              </>
            ) : (
              <Empty
                title="Elige tu siguiente producto"
                description="Selecciona una pieza disponible del catálogo de abajo."
              />
            )}
          </div>
          <div className="live-catalog">
            <div className="row between">
              <h3>Seleccionar producto</h3>
              <span className="muted small">{products.length} piezas</span>
            </div>
            <Search value={search} onChange={setSearch} placeholder="Buscar producto o código…" />
            {products.length ? (
              <div className="live-product-list">
                {products.map((x) => (
                  <button
                    key={x.id}
                    className={`live-product ${selected === x.id ? 'selected' : ''}`}
                    onClick={() => setSelected(x.id)}
                  >
                    <ProductPhoto p={x} />
                    <div>
                      <strong>{x.name}</strong>
                      <span className="muted small">
                        {x.code} · {currency(x.price)}
                      </span>
                    </div>
                    <Badge>{x.status}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="Sin productos disponibles"
                description="Registra nuevas piezas o cambia la búsqueda."
                action={<Button onClick={() => go('inventario')}>Ir a inventario</Button>}
              />
            )}
          </div>
        </section>
        <section className="panel queue-panel">
          <div className="panel-heading">
            <div>
              <h2>Cola de interesados</h2>
              <p className="muted small">La prioridad sigue el orden de llegada.</p>
            </div>
            <span className="queue-count">{p?.queue.length || 0}</span>
          </div>
          <div className="queue-content">
            {p && ['En Live', 'Reservado'].includes(p.status) ? (
              <>
                <div className="queue-product">
                  <span className="code">{p.code}</span>
                  <strong>{p.name}</strong>
                </div>
                <Field
                  select
                  label="Cliente interesado"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                >
                  {data.customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} · {c.contact}
                    </MenuItem>
                  ))}
                </Field>
                <div className="row between">
                  <button className="sample-link" onClick={() => setNewCustomer(true)}>
                    + Nuevo cliente
                  </button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Icon name="plus" size={16} />}
                    onClick={() => act((d) => reserve(d, p.id, customer), 'Cliente agregado a la cola.')}
                  >
                    Agregar a cola
                  </Button>
                </div>
                {p.queue.length ? (
                  <div className="queue-list">
                    {p.queue.map((cid, i) => (
                      <div key={cid} className={`queue-person ${i === 0 ? 'first' : ''}`}>
                        <span className="queue-number">{i + 1}</span>
                        <Avatar
                          sx={{
                            width: 34,
                            height: 34,
                            bgcolor: i === 0 ? '#e8e1f7' : '#f1f0f5',
                            color: '#796799',
                            fontSize: 12,
                          }}
                        >
                          {clientName(data, cid)
                            .split(' ')
                            .map((x) => x[0])
                            .join('')
                            .slice(0, 2)}
                        </Avatar>
                        <div>
                          <strong>{clientName(data, cid)}</strong>
                          <span>{i === 0 ? 'Primera prioridad' : 'En espera'}</span>
                        </div>
                        <button
                          className="text-cancel"
                          aria-label={`Cancelar reserva de ${clientName(data, cid)}`}
                          onClick={() =>
                            act((d) => cancel(d, p.id, cid), 'Reserva cancelada. La cola se actualizó.')
                          }
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="queue-empty">
                    <Icon name="users" size={30} />
                    <h3>¿Quién se lo queda?</h3>
                    <p>
                      Agrega a las personas interesadas.
                      <br />
                      La primera tendrá prioridad.
                    </p>
                  </div>
                )}
                {p.queue.length > 0 && (
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<Icon name="check" />}
                    onClick={() => setConfirm(p)}
                  >
                    Confirmar comprador
                  </Button>
                )}
              </>
            ) : (
              <div className="queue-empty">
                <Icon name="users" size={35} />
                <h3>Todo comienza con una pieza</h3>
                <p>Presenta un producto para agregar interesados y gestionar sus reservas.</p>
              </div>
            )}
            <div className="helper-note">
              <Icon name="truck" />
              <div>
                <strong>De la venta a la entrega</strong>
                <p>
                  Al confirmar, las piezas se agrupan en el pedido pendiente de tu cliente. Los pagos se
                  registran en Entregas.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
      {session && (
        <Modal
          title="Iniciar un live"
          subtitle="Organiza las ventas mientras transmites desde tu red social."
          onClose={() => setSession(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                act((d) => {
                  if (!name.trim()) throw new Error('Escribe un nombre.');
                  d.live = { active: true, name: name.trim(), shown: [], sold: [] };
                }, 'Live iniciado.')
              )
                setSession(false);
            }}
          >
            <Field
              label="Nombre de la sesión"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
            />
            <Alert severity="info">Este panel no transmite video ni lee comentarios de redes sociales.</Alert>
            <Actions onClose={() => setSession(false)} label="Iniciar live" />
          </form>
        </Modal>
      )}
      {ending && (
        <Modal
          title="¿Finalizar el live?"
          subtitle="Las piezas presentadas sin reserva volverán a disponibles. Las reservas pendientes se conservarán para confirmarlas después."
          onClose={() => setEnding(false)}
        >
          <div className="form-actions">
            <Button onClick={() => setEnding(false)}>Continuar live</Button>
            <Button
              variant="contained"
              onClick={() => {
                if (act(finishLive, 'Live finalizado. Las reservas pendientes se conservaron.'))
                  setEnding(false);
              }}
            >
              Finalizar live
            </Button>
          </div>
        </Modal>
      )}
      {confirm && (
        <ConfirmSale
          product={confirm}
          onClose={() => setConfirm(null)}
          onSold={(oid) => {
            setLastOrder(oid);
            setConfirm(null);
          }}
        />
      )}
      {newCustomer && (
        <CustomerForm
          onClose={() => setNewCustomer(false)}
          onCreated={(cid) => {
            setCustomer(cid);
            setNewCustomer(false);
          }}
        />
      )}
    </>
  );
}
function ConfirmSale({
  product,
  onClose,
  onSold,
}: {
  product: Product;
  onClose: () => void;
  onSold: (oid: string) => void;
}) {
  const { data, act } = useDemo();
  const [price, setPrice] = useState(String(product.price / 100));
  const cid = product.queue[0];
  const pending = data.orders.find((o) => o.customerId === cid && o.status === 'Pendiente');
  return (
    <Modal
      title="Confirmar comprador"
      subtitle="La confirmación registra una venta. El pago se recibe en Entregas."
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          let oid = '';
          if (
            act((d) => {
              oid = sale(d, product.id, cents(price)).id;
            }, 'Venta confirmada.')
          )
            onSold(oid);
        }}
      >
        <div className="sale-summary">
          <ProductPhoto p={product} />
          <div>
            <strong>{product.name}</strong>
            <p className="muted small">
              {product.code} · {clientName(data, cid)}
            </p>
          </div>
        </div>
        <Field
          label="Precio final de venta (Q)"
          value={price}
          required
          onChange={(e) => setPrice(e.target.value)}
          inputProps={{ inputMode: 'decimal' }}
        />
        <Alert severity="info">
          {pending
            ? `Se agregará al pedido ${pending.code} de ${clientName(data, cid)}.`
            : `Se creará un pedido para ${clientName(data, cid)}.`}{' '}
          No se registra ningún pago automáticamente.
        </Alert>
        <Actions onClose={onClose} label="Confirmar venta" />
      </form>
    </Modal>
  );
}
function CustomerForm({ onClose, onCreated }: { onClose: () => void; onCreated: (cid: string) => void }) {
  const { act } = useDemo();
  const [name, setName] = useState(''),
    [contact, setContact] = useState(''),
    [address, setAddress] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    let cid = '';
    if (
      act((d) => {
        if (!name.trim() || !contact.trim()) throw new Error('Nombre y contacto son obligatorios.');
        if (d.customers.some((c) => c.contact.toLowerCase().trim() === contact.toLowerCase().trim()))
          throw new Error('Ya existe un cliente con ese contacto.');
        cid = id();
        d.customers.push({ id: cid, name: name.trim(), contact: contact.trim(), address: address.trim() });
      }, 'Cliente registrado.')
    )
      onCreated(cid);
  }
  return (
    <Modal title="Nuevo cliente" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Nombre completo" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="WhatsApp o usuario de red social"
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <Field
          label="Dirección de entrega"
          multiline
          minRows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <Actions onClose={onClose} label="Crear cliente" />
      </form>
    </Modal>
  );
}
