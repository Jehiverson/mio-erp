import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@mui/material';
import type { CommerceCommand } from '@hackaton/shared';
import { useDemo, type DemoContextType } from './common';
import { currency, id, type Demo } from './model';
export type CommerceResult = {
  orderId?: string;
  customerId?: string;
  revision?: number;
};
type Pending = {
  operationId: string;
  command: CommerceCommand;
  status: 'sending' | 'uncertain';
};
type Cloud = NonNullable<DemoContextType['cloud']>;
const event = 'hackaton-commerce-pending';
const registry = new Map<string, Pending>();
const runningKeys = new Set<string>();
const settled = new Set<string>();
const definitive = new Set([
  'functions/aborted',
  'functions/invalid-argument',
  'functions/failed-precondition',
  'functions/not-found',
  'functions/already-exists',
  'functions/resource-exhausted',
]);
const prefix = (scope: string) => `hackaton.commerce.${scope}.`;
const emit = () => window.dispatchEvent(new Event(event));
function read(key: string): Pending | null {
  if (registry.has(key)) return registry.get(key)!;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null') as Pending | null;
    if (
      saved &&
      typeof saved.operationId === 'string' &&
      saved.command &&
      typeof saved.command.kind === 'string' &&
      !settled.has(saved.operationId)
    ) {
      saved.status = 'uncertain';
      registry.set(key, saved);
      return saved;
    }
  } catch {
    /* Una sesión sin almacenamiento no puede iniciar una operación persistente. */
  }
  return null;
}
function save(key: string, request: Pending) {
  // Persistir ANTES de enviar permite reintentar exactamente el mismo cobro tras una recarga.
  sessionStorage.setItem(key, JSON.stringify(request));
  registry.set(key, request);
  emit();
}
function clear(key: string, request: Pending) {
  settled.add(request.operationId);
  registry.delete(key);
  // Una respuesta confirmada sigue siendo éxito aunque el navegador falle al limpiar su almacenamiento.
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* settled evita volver a cargar este recibo durante la sesión. */
  }
  emit();
}
function all(scope: string) {
  const start = prefix(scope);
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(start)) read(key);
    }
  } catch {
    /* Las operaciones en memoria siguen siendo verificables. */
  }
  return [...registry.entries()].filter(([key]) => key.startsWith(start));
}
async function perform(key: string, cloud: Cloud): Promise<CommerceResult> {
  const request = read(key);
  if (!request) throw new Error('La operación ya fue resuelta. Revisa los datos actualizados.');
  if (runningKeys.has(key)) throw new Error('Esta operación ya se está verificando.');
  runningKeys.add(key);
  request.status = 'sending';
  emit();
  try {
    const result = await cloud.executeCommerce(request.command, request.operationId);
    clear(key, request);
    return result;
  } catch (error) {
    if (
      definitive.has(
        (
          error as {
            code?: string;
          }
        ).code || '',
      )
    )
      clear(key, request);
    else {
      request.status = 'uncertain';
      try {
        sessionStorage.setItem(key, JSON.stringify(request));
      } catch {
        /* Se conserva en memoria. */
      }
      emit();
    }
    throw error;
  } finally {
    runningKeys.delete(key);
    emit();
  }
}
export function useCommerce(slot: string) {
  const { cloud, act, notify } = useDemo();
  const key = cloud ? prefix(cloud.commerceScope) + slot : '';
  const [pending, setPending] = useState<Pending | null>(() => (key ? read(key) : null));
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => setPending(key ? read(key) : null);
    window.addEventListener(event, sync);
    return () => window.removeEventListener(event, sync);
  }, [key]);
  const blocked = !!cloud && (!cloud.canEdit || cloud.loading || !!cloud.error);
  async function run(
    build: () => CommerceCommand,
    demo: (d: Demo) => CommerceResult | void,
    message: string,
  ): Promise<CommerceResult | undefined> {
    if (running.current || (key && runningKeys.has(key))) return;
    if (blocked) {
      setError('No puedes modificar datos mientras se verifica el acceso o la conexión.');
      return;
    }
    running.current = true;
    setBusy(true);
    setError('');
    try {
      if (!cloud) {
        let result: CommerceResult = {};
        const ok = act((d) => {
          result = demo(d) || {};
        }, message);
        return ok ? result : undefined;
      }
      if (!read(key)) save(key, { operationId: id(), command: build(), status: 'sending' });
      const result = await perform(key, cloud);
      notify(message);
      return result;
    } catch (error) {
      setError(
        key && read(key)
          ? 'No se pudo confirmar el resultado. Reintenta la misma operación; no registres un cobro nuevo. Los datos enviados se conservan.'
          : error instanceof Error
            ? error.message
            : 'Revisa los datos y vuelve a intentarlo.',
      );
      return;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    blocked,
    pending,
    error,
    locked: busy || !!pending,
    canClose: !busy,
    retry: () =>
      run(
        () => {
          throw new Error('No hay operación pendiente.');
        },
        () => {},
        'Operación confirmada.',
      ),
    label: (normal: string) => (busy ? 'Guardando…' : pending ? 'Verificar y reintentar' : normal),
  };
}
export function CommerceFeedback({
  op,
  retry = false,
}: {
  op: ReturnType<typeof useCommerce>;
  retry?: boolean;
}) {
  return (
    <>
      {op.blocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Solo lectura: comprueba tu acceso y la conexión antes de modificar datos.
        </Alert>
      )}
      {(op.error || op.pending) && (
        <Alert
          severity={op.pending ? 'warning' : 'error'}
          sx={{ mb: 2 }}
          action={
            retry && op.pending ? (
              <Button disabled={op.busy || op.blocked} color="inherit" onClick={() => void op.retry()}>
                Verificar y reintentar
              </Button>
            ) : undefined
          }
        >
          {op.error ||
            'La operación está pendiente de respuesta. Puedes cerrar esta ventana y verificarla desde operaciones pendientes sin duplicarla.'}
          {op.pending && <CommandDetails command={op.pending.command} operationId={op.pending.operationId} />}
        </Alert>
      )}
    </>
  );
}
const names: Record<CommerceCommand['kind'], string> = {
  startLive: 'Inicio de live',
  finishLive: 'Cierre de live',
  present: 'Presentación de producto',
  reserve: 'Reserva',
  cancelReservation: 'Cancelación de reserva',
  confirmSale: 'Confirmación de venta',
  createCustomer: 'Registro de cliente',
  planDelivery: 'Planificación de envío',
  recordPayment: 'Pago o abono',
  shipOrder: 'Despacho',
  deliverOrder: 'Entrega y cobro',
  returnOrder: 'Devolución',
  reconcileDeposit: 'Conciliación de depósito',
  restock: 'Reintegro al inventario',
};
function CommandDetails({ command, operationId }: { command: CommerceCommand; operationId: string }) {
  const { data } = useDemo();
  const fields: [string, string][] = [];
  if ('productId' in command) {
    const p = data.products.find((p) => p.id === command.productId);
    fields.push(['Producto', p ? `${p.code} · ${p.name}` : command.productId]);
  }
  if ('customerId' in command) {
    const c = data.customers.find((c) => c.id === command.customerId);
    fields.push([
      'Cliente',
      command.kind === 'createCustomer' ? command.name : c ? `${c.name} · ${c.contact}` : command.customerId,
    ]);
  }
  if ('orderId' in command) {
    const order = data.orders.find((o) => o.id === command.orderId);
    fields.push(['Pedido', order?.code || command.orderId]);
  }
  if ('price' in command) fields.push(['Precio final', currency(command.price)]);
  if ('amount' in command) fields.push(['Monto', currency(command.amount)]);
  if ('method' in command) fields.push(['Método', command.method]);
  if ('collected' in command) fields.push(['Cobro al entregar', currency(command.collected)]);
  if ('name' in command && command.kind === 'startLive') fields.push(['Sesión', command.name]);
  if ('contact' in command) fields.push(['Contacto', command.contact]);
  if ('address' in command) fields.push(['Dirección', command.address]);
  if ('courier' in command)
    fields.push(
      ['Mensajero', command.courier],
      ['Fecha', command.date],
      ['Guía', command.guide || 'Se generará internamente'],
      ['Envío cobrado', currency(command.shipping)],
      ['Costo mensajero', currency(command.shippingCost)],
      ['Contraentrega', command.cod ? 'Sí' : 'No'],
    );
  if ('reference' in command) fields.push(['Referencia', command.reference || 'Sin referencia']);
  if ('account' in command) fields.push(['Cuenta', command.account]);
  if ('reason' in command) fields.push(['Motivo', command.reason]);
  return (
    <details style={{ fontSize: 12, marginTop: 8 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ver datos enviados</summary>
      <dl className="detail-list">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>Referencia de operación</dt>
          <dd>{operationId}</dd>
        </div>
      </dl>
    </details>
  );
}
export function PendingCommercePanel() {
  const { cloud, notify, go, data } = useDemo();
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  useEffect(() => {
    const sync = () => setVersion((v) => v + 1);
    window.addEventListener(event, sync);
    return () => window.removeEventListener(event, sync);
  }, []);
  void version;
  if (!cloud) return null;
  const requests = all(cloud.commerceScope);
  const blocked = !cloud.canEdit || cloud.loading || !!cloud.error;
  return (
    <>
      {message && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          onClose={() => setMessage('')}
          action={
            orderId ? (
              <Button color="inherit" onClick={() => go('entregas', orderId)}>
                Ver pedido
              </Button>
            ) : undefined
          }
        >
          {message}
        </Alert>
      )}
      {requests.map(([key, request]) => {
        const command = request.command;
        const order = 'orderId' in command ? data.orders.find((o) => o.id === command.orderId) : undefined;
        return (
          <Alert
            key={key}
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button
                disabled={blocked || runningKeys.has(key)}
                color="inherit"
                onClick={async () => {
                  try {
                    const result = await perform(key, cloud);
                    notify('Operación verificada correctamente.');
                    setMessage(
                      'La operación fue confirmada. Revisa el estado actualizado antes de registrar otra.',
                    );
                    setOrderId(result.orderId || ('orderId' in command ? command.orderId : ''));
                  } catch (error) {
                    setMessage(
                      read(key)
                        ? 'El resultado sigue pendiente. Conserva esta operación y vuelve a verificarla; no registres un cobro nuevo.'
                        : error instanceof Error
                          ? error.message
                          : 'Revisa los datos actualizados.',
                    );
                  }
                }}
              >
                {runningKeys.has(key) ? 'Verificando…' : 'Verificar y reintentar'}
              </Button>
            }
          >
            <strong>{names[command.kind]}</strong>
            {order ? ` · ${order.code}` : ''}
            {'amount' in command ? ` · ${currency(command.amount)}` : ''}
            {'collected' in command ? ` · cobro ${currency(command.collected)}` : ''}
            <br />
            {runningKeys.has(key)
              ? 'Esperando respuesta del servidor.'
              : 'Resultado pendiente. Se reenviarán exactamente los mismos datos y el mismo identificador para evitar duplicados.'}
            <CommandDetails command={command} operationId={request.operationId} />
          </Alert>
        );
      })}
    </>
  );
}
