import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { StoredProduct, CommerceCommand } from '@hackaton/shared';
import { httpsCallable } from 'firebase/functions';
import DemoApp from '../prototype/App';
import type { Demo, Customer, Order } from '../prototype/model';
import AccessScreen from './AccessScreen';
import {
  firebaseClient,
  firebaseMessage,
  login,
  logout,
  missingConfig,
  storeId,
  storeName,
  useEmulators,
  qwenEnabled,
} from './client';
import { displayProduct, saveCloudProduct, analyzeCloudProduct, type CloudProduct } from './inventory';
function currentMode() {
  return new URLSearchParams(location.search).get('mode') === 'demo' ? 'demo' : 'cloud';
}
export default function Entry() {
  const [mode, setMode] = useState(currentMode);
  function switchMode(next: 'demo' | 'cloud') {
    const url = new URL(location.href);
    if (next === 'demo') url.searchParams.set('mode', 'demo');
    else url.searchParams.delete('mode');
    url.hash = 'inventario';
    history.replaceState(null, '', url);
    setMode(next);
  }
  return mode === 'demo' ? (
    <DemoApp onCloud={() => switchMode('cloud')} />
  ) : (
    <CloudEntry onDemo={() => switchMode('demo')} />
  );
}
function CloudEntry({ onDemo }: { onDemo: () => void }) {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(!missingConfig.length),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (missingConfig.length) return;
    try {
      return onAuthStateChanged(
        firebaseClient().auth,
        (u) => {
          setUser(u);
          setChecking(false);
        },
        () => {
          setError('No se pudo verificar la sesión. Reintenta el acceso.');
          setChecking(false);
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : firebaseMessage(e));
      setChecking(false);
    }
  }, []);
  if (checking) return <Loading text="Verificando sesión…" />;
  if (!user)
    return (
      <AccessScreen
        missing={missingConfig}
        loading={busy}
        error={error}
        onDemo={onDemo}
        onLogin={async (email, password) => {
          setBusy(true);
          setError('');
          try {
            await login(email, password);
          } catch (e) {
            setError(firebaseMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  return <CloudWorkspace key={user.uid} user={user} onDemo={onDemo} />;
}
function CloudWorkspace({ user, onDemo }: { user: User; onDemo: () => void }) {
  const [membership, setMembership] = useState<'loading' | 'allowed' | 'denied'>('loading');
  const [role, setRole] = useState('');
  const [products, setProducts] = useState<CloudProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [live, setLive] = useState<Demo['live']>({
    active: false,
    name: 'Sin sesión activa',
    shown: [],
    sold: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const photoCache = useRef(new Map<string, Promise<string>>());
  useEffect(
    () => () => {
      for (const photo of photoCache.current.values())
        void photo.then(URL.revokeObjectURL).catch(() => undefined);
      photoCache.current.clear();
    },
    [],
  );
  useEffect(() => {
    setMembership('loading');
    setError('');
    return onSnapshot(
      doc(firebaseClient().db, 'stores', storeId, 'members', user.uid),
      (snapshot) => {
        const m = snapshot.data();
        if (m?.active === true && ['admin', 'editor', 'viewer'].includes(m.role)) {
          setRole(m.role);
          setMembership('allowed');
        } else {
          setMembership('denied');
          setProducts([]);
        }
      },
      () => {
        setMembership('denied');
        setError('No se pudo verificar el acceso a esta tienda. Revisa la conexión y tus permisos.');
      },
    );
  }, [user.uid, retry]);
  useEffect(() => {
    if (membership !== 'allowed') return;
    let alive = true,
      generation = 0;
    const ready: Record<string, boolean> = { products: false, customers: false, orders: false, live: false };
    const errors: Record<string, string> = {};
    setLoading(true);
    setError('');
    const update = () => {
      if (!alive) return;
      setLoading(Object.values(ready).some((value) => !value));
      setError(Object.values(errors).join(' '));
    };
    const fail = (name: string) => (e: unknown) => {
      if (!alive) return;
      ready[name] = true;
      errors[name] =
        `${name === 'products' ? 'Inventario' : name === 'customers' ? 'Clientes' : name === 'orders' ? 'Pedidos' : 'Live'}: ${firebaseMessage(e)}`;
      update();
    };
    const source = (name: string) =>
      query(
        collection(firebaseClient().db, 'stores', storeId, name),
        orderBy('createdAt', 'desc'),
        limit(200),
      );
    const subscriptions = [
      onSnapshot(
        source('products'),
        (snapshot) => {
          const request = ++generation;
          void Promise.all(
            snapshot.docs.map((d) =>
              displayProduct({ ...d.data(), id: d.id } as StoredProduct, photoCache.current),
            ),
          )
            .then((items) => {
              if (!alive || request !== generation) return;
              setProducts(items);
              ready.products = true;
              delete errors.products;
              update();
            })
            .catch(fail('products'));
        },
        fail('products'),
      ),
      onSnapshot(
        source('customers'),
        (snapshot) => {
          if (!alive) return;
          setCustomers(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Customer));
          ready.customers = true;
          delete errors.customers;
          update();
        },
        fail('customers'),
      ),
      onSnapshot(
        source('orders'),
        (snapshot) => {
          if (!alive) return;
          setOrders(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Order));
          ready.orders = true;
          delete errors.orders;
          update();
        },
        fail('orders'),
      ),
      onSnapshot(
        doc(firebaseClient().db, 'stores', storeId, 'live', 'current'),
        (snapshot) => {
          if (!alive) return;
          setLive(
            snapshot.exists()
              ? (snapshot.data() as Demo['live'])
              : { active: false, name: 'Sin sesión activa', shown: [], sold: [] },
          );
          ready.live = true;
          delete errors.live;
          update();
        },
        fail('live'),
      ),
    ];
    return () => {
      alive = false;
      subscriptions.forEach((stop) => stop());
    };
  }, [membership, retry]);
  if (membership === 'loading') return <Loading text="Verificando acceso a la tienda…" />;
  if (membership === 'denied')
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 4, mt: 8 }}>
        <Alert severity="warning">
          {error || 'Tu cuenta está autenticada, pero no tiene acceso a esta tienda.'}
        </Alert>
        <p style={{ marginTop: 20 }}>
          Tienda: {storeName} · Usuario: {user.email}. Solicita acceso al administrador.
        </p>
        <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          <Button onClick={() => setRetry((x) => x + 1)}>Reintentar acceso</Button>
          <Button
            onClick={() => void logout().catch(() => setError('No se pudo cerrar la sesión. Reintenta.'))}
          >
            Cambiar cuenta
          </Button>
          <Button onClick={onDemo}>Abrir demostración local</Button>
        </Box>
      </Box>
    );
  const data: Demo = {
    products,
    customers,
    orders,
    live,
    nextProduct: 1,
    nextOrder: 1,
  };
  return (
    <DemoApp
      cloud={{
        data,
        commerceScope: `${storeId}.${user.uid}`,
        executeCommerce: async (command: CommerceCommand, operationId: string) => {
          const call = httpsCallable<
            {
              storeId: string;
              operationId: string;
              command: CommerceCommand;
            },
            {
              orderId?: string;
              customerId?: string;
              revision?: number;
            }
          >(firebaseClient().functions, 'executeCommerce');
          try {
            return (await call({ storeId, operationId, command })).data;
          } catch (e) {
            const code = (
              e as {
                code?: string;
              }
            ).code;
            throw Object.assign(new Error(firebaseMessage(e)), { code });
          }
        },
        aiEnabled: qwenEnabled,
        loading,
        error,
        canEdit: role === 'admin' || role === 'editor',
        email: user.email || user.uid,
        storeLabel: storeName,
        emulators: useEmulators,
        onRetry: () => setRetry((x) => x + 1),
        saveProduct: async (draft, operation, previous, targetId) => {
          try {
            return await saveCloudProduct(draft, operation, previous as CloudProduct | undefined, targetId);
          } catch (e) {
            throw new Error(
              (
                e as {
                  code?: string;
                }
              ).code
                ? firebaseMessage(e)
                : (e as Error).message,
            );
          }
        },
        analyzeProduct: async (text, image, operation) => {
          try {
            return await analyzeCloudProduct(text, image, operation);
          } catch (e) {
            throw new Error(firebaseMessage(e));
          }
        },
        onLogout: () => void logout().catch(() => setError('No se pudo cerrar sesión. Reintenta.')),
        onDemo,
      }}
    />
  );
}
function Loading({ text }: { text: string }) {
  return (
    <Box
      role="status"
      sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}
    >
      <CircularProgress size={24} />
      <span>{text}</span>
    </Box>
  );
}
