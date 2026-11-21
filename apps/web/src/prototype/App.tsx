import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  CssBaseline,
  Drawer,
  Snackbar,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from '@mui/material';
import { DemoContext, Icon, Modal, type Page, type DemoContextType } from './common';
import { initialDemo, type Demo } from './model';
import Inventory from './Inventory';
import Live from './Live';
import Deliveries from './Deliveries';
import './prototype.css';
import { brand } from './brand';
import { PendingCommercePanel } from './commerce';
const key = 'hackaton.phase2.demo.v1';
function load() {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const d = JSON.parse(raw) as Demo;
      if (
        Array.isArray(d.products) &&
        Array.isArray(d.orders) &&
        Array.isArray(d.customers) &&
        d.live &&
        d.nextProduct &&
        d.nextOrder
      )
        return d;
    }
  } catch {
    /* Un almacenamiento no disponible inicia una demo nueva. */
  }
  return initialDemo();
}
const pages: {
  id: Page;
  label: string;
  sub: string;
  icon: 'store' | 'live' | 'truck';
}[] = [
  { id: 'inventario', label: 'Inventario', sub: 'Organiza tus productos', icon: 'store' },
  { id: 'live', label: 'Ventas live', sub: 'De la reserva al pedido', icon: 'live' },
  { id: 'entregas', label: 'Entregas y pagos', sub: 'Cada pedido, hasta el final', icon: 'truck' },
];
function hashPage(): Page {
  const h = window.location.hash.slice(1).split('/')[0];
  return pages.some((p) => p.id === h) ? (h as Page) : 'inventario';
}
export type CloudWorkspaceProps = NonNullable<DemoContextType['cloud']> & {
  data: Demo;
  email: string;
  storeLabel: string;
  emulators: boolean;
  onLogout: () => void;
  onDemo: () => void;
};
export default function App({
  cloud,
  onCloud,
}: {
  cloud?: CloudWorkspaceProps;
  onCloud?: () => void;
} = {}) {
  const [demoData, setData] = useState<Demo>(load);
  const data = cloud?.data || demoData;
  const current = useRef(demoData);
  const [page, setPage] = useState<Page>(hashPage);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const isMobile = useMediaQuery('(max-width:760px)');
  const [reset, setReset] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          primary: { main: brand.accent, contrastText: brand.cream },
          secondary: { main: brand.orange, contrastText: '#182e40' },
          background: { default: brand.canvas, paper: '#fff' },
          text: { primary: brand.ink, secondary: brand.muted },
        },
        typography: {
          fontFamily: '"Mulish", "Avenir Next", Arial, sans-serif',
          button: { textTransform: 'none', fontWeight: 700, fontSize: 13 },
        },
        shape: { borderRadius: 12 },
        components: {
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: { root: { padding: '10px 18px', borderRadius: 10, whiteSpace: 'nowrap', fontWeight: 750 },
              containedPrimary: { backgroundColor: brand.accent, color: brand.cream, '&:hover': { backgroundColor: '#09345c' }, '&.Mui-disabled': { backgroundColor: '#e5e9ed', color: '#677785' } } },
          },
          MuiTextField: { defaultProps: { variant: 'outlined' } },
          MuiOutlinedInput: { styleOverrides: { root: { fontSize: 14, borderRadius: 9 } } },
          MuiDialogTitle: { styleOverrides: { root: { padding: '22px 24px 16px' } } },
          MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px 24px' } } },
        },
      }),
    [],
  );
  useEffect(() => {
    document.title = `${brand.name} · ${brand.subtitle}`;
    document.documentElement.style.setProperty('--accent', brand.accent);
    document.documentElement.style.setProperty('--accent-soft', brand.accentSoft);
  }, []);
  useEffect(() => {
    const f = () => {
      setPage(hashPage());
      setMobile(false);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const go = (p: Page, oid?: string) => {
    setPage(p);
    window.location.hash = p;
    setOrderId(oid || null);
    setMobile(false);
    window.scrollTo(0, 0);
  };
  const act = (fn: (d: Demo) => void, message?: string) => {
    try {
      if (cloud) throw new Error('Esta operación se habilitará al conectar Live y Entregas.');
      const copy = structuredClone(current.current);
      fn(copy);
      localStorage.setItem(key, JSON.stringify(copy));
      current.current = copy;
      setData(copy);
      if (message) setNotice({ text: message, error: false });
      return true;
    } catch (e) {
      setNotice({
        text: e instanceof Error ? e.message : 'No se pudo guardar la demostración.',
        error: true,
      });
      return false;
    }
  };
  const active = pages.find((p) => p.id === page)!;
  const pending = data.orders.filter((o) => o.status === 'Pendiente').length;
  const sidebar = (
    <aside className="sidebar">
      <a className="brand" href="#inventario" onClick={() => go('inventario')}>
        <span className="brand-symbol">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} width="36" height="36" style={{ objectFit: 'contain' }} />
          ) : (
            <Icon name="store" size={27} />
          )}
        </span>
        <span>
          {brand.name}
          <small>{brand.subtitle}</small>
        </span>
      </a>
      <p className="nav-label">ESPACIO DE TRABAJO</p>
      <nav aria-label="Navegación principal">
        {pages.map((p) => (
          <button
            key={p.id}
            className={`nav-item ${p.id === page ? 'active' : ''}`}
            onClick={() => go(p.id)}
            aria-current={p.id === page ? 'page' : undefined}
          >
            <Icon name={p.icon} size={23} />
            <span>{p.label}</span>
            {p.id === 'entregas' && pending > 0 && <span className="nav-count">{pending}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="flow-note">
          <img className="sidebar-mascot" src="/images/mio/mascot-dark.png" alt="" aria-hidden="true" />
          <span className="mini-title">TODO CONECTADO</span>
          <p>
            Del primer producto
            <br />a la última entrega.
          </p>
          <div className="flow-icons">
            <Icon name="store" />
            <span>→</span>
            <Icon name="live" />
            <span>→</span>
            <Icon name="truck" />
          </div>
        </div>
        {!cloud && (
          <button className="reset-link" onClick={() => setReset(true)}>
            <Icon name="reset" size={17} />
            Reiniciar demostración
          </button>
        )}
        {cloud && (
          <button className="reset-link" onClick={cloud.onLogout}>
            Cerrar sesión
          </button>
        )}
        {(cloud?.onDemo || onCloud) && (
          <button className="reset-link" onClick={cloud?.onDemo || onCloud}>
            {cloud ? 'Abrir demo local' : 'Volver a acceso Firebase'}
          </button>
        )}
        <div className="sidebar-profile">
          <Avatar sx={{ width: 34, height: 34, bgcolor: brand.accentSoft, color: brand.accent, fontSize: 12 }}>
            AD
          </Avatar>
          <div>
            <strong>{cloud ? cloud.email : 'Administrador'}</strong>
            <small>{cloud ? cloud.storeLabel : 'Cuenta de demostración'}</small>
          </div>
        </div>
      </div>
    </aside>
  );
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DemoContext.Provider
        value={{
          data,
          act,
          go,
          orderId,
          setOrderId,
          cloud,
          notify: (text) => setNotice({ text, error: false }),
        }}
      >
        <div className="app-shell">
          {isMobile ? (
            <Drawer
              open={mobile}
              onClose={() => setMobile(false)}
              PaperProps={{ className: 'mobile-sidebar-paper' }}
            >
              {sidebar}
            </Drawer>
          ) : (
            sidebar
          )}
          <div className="workspace">
            <header className="topbar">
              <div className="row">
                <button
                  className="mobile-menu icon-button"
                  aria-label="Abrir menú"
                  aria-expanded={mobile}
                  onClick={() => setMobile(!mobile)}
                >
                  <Icon name="menu" />
                </button>
                <span className="breadcrumb">
                  {brand.name} <span>/</span> <strong>{active.label}</strong>
                </span>
              </div>
              <div className="row header-right">
                <span className="demo-tag">
                  <span />
                  {cloud
                    ? cloud.emulators
                      ? 'Emuladores Firebase'
                      : 'Firebase · Tienda'
                    : 'Demostración local'}
                </span>
                <span className="top-divider" />
                <Avatar sx={{ width: 34, height: 34, fontSize: 12, bgcolor: brand.accentSoft, color: brand.accent }}>
                  AD
                </Avatar>
              </div>
            </header>
            <main id="main-content">
              <PendingCommercePanel />
              <div className="eyebrow">TU OPERACIÓN, EN UN SOLO LUGAR</div>
              {cloud?.loading && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Sincronizando datos de la tienda… Las operaciones están pausadas.
                </Alert>
              )}
              {cloud?.error && (
                <Alert
                  severity="error"
                  sx={{ mb: 2 }}
                  action={
                    <Button color="inherit" onClick={cloud.onRetry}>
                      Reintentar
                    </Button>
                  }
                >
                  {cloud.error}
                </Alert>
              )}
              {cloud && !cloud.canEdit && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Acceso de solo lectura. Puedes consultar inventario, ventas y entregas.
                </Alert>
              )}
              {page === 'inventario' ? <Inventory /> : page === 'live' ? <Live /> : <Deliveries />}
              <footer className="page-footer">
                <span>
                  {cloud
                    ? `Tienda conectada · ${cloud.storeLabel} · Hasta 200 registros por módulo`
                    : 'Datos de ejemplo · Cambios guardados solo en este navegador'}
                </span>
                <span>
                  {cloud
                    ? 'Datos de la tienda · IA disponible en próxima fase'
                    : 'Demo separada del inventario Firebase'}
                </span>
              </footer>
            </main>
          </div>
        </div>
        {reset && (
          <Modal
            title="¿Reiniciar la demostración?"
            subtitle="Se eliminarán únicamente los cambios de este prototipo local y se restaurarán los datos de ejemplo."
            onClose={() => setReset(false)}
          >
            <div className="form-actions">
              <Button color="inherit" onClick={() => setReset(false)}>
                Conservar cambios
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  try {
                    const fresh = initialDemo();
                    localStorage.setItem(key, JSON.stringify(fresh));
                    current.current = fresh;
                    setData(fresh);
                    setReset(false);
                    go('inventario');
                    setNotice({ text: 'Demostración reiniciada.', error: false });
                  } catch {
                    setNotice({ text: 'No se pudo reiniciar el almacenamiento local.', error: true });
                  }
                }}
              >
                Reiniciar demo
              </Button>
            </div>
          </Modal>
        )}
        <Snackbar
          open={!!notice}
          autoHideDuration={6000}
          onClose={() => setNotice(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={notice?.error ? 'error' : 'success'}
            variant="filled"
            onClose={() => setNotice(null)}
          >
            {notice?.text}
          </Alert>
        </Snackbar>
      </DemoContext.Provider>
    </ThemeProvider>
  );
}
