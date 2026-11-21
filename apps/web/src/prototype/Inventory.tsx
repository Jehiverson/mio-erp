import { useRef, useState, type FormEvent } from 'react';
import { useCommerce, CommerceFeedback } from './commerce';
import { Alert, Button, CircularProgress, IconButton, MenuItem, Pagination } from '@mui/material';
import { Actions, Badge, Empty, Field, Icon, Modal, Search, Stat, readPhoto, useDemo } from './common';
import { createProduct, currency, emptyDraft, id, type Product, type ProductDraft } from './model';
export function ProductPhoto({ p }: { p: Pick<Product, 'name' | 'photo'> }) {
  return p.photo ? (
    <img className="product-photo" src={p.photo} alt={p.name} loading="lazy" />
  ) : (
    <span className="product-photo placeholder">
      <Icon name="store" size={25} />
    </span>
  );
}
export default function Inventory() {
  const { data, go, cloud } = useDemo();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Todos');
  const [type, setType] = useState('Todos');
  const [grid, setGrid] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<'manual' | 'ai' | null>(null);
  const [detailSnapshot, setDetail] = useState<Product | null>(null);
  const detail = detailSnapshot ? data.products.find((p) => p.id === detailSnapshot.id) || null : null;
  const [edit, setEdit] = useState<Product | null>(null);
  const [inspect, setInspect] = useState<Product | null>(null);
  const filtered = data.products.filter(
    (p) =>
      (status === 'Todos' || p.status === status) &&
      (type === 'Todos' || p.type === type) &&
      `${p.name} ${p.code} ${p.brand}`.toLowerCase().includes(search.toLowerCase()),
  );
  const available = data.products.filter((p) => p.status === 'Disponible');
  const active = data.products.filter((p) => ['En Live', 'Reservado'].includes(p.status));
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * 6, current * 6);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Inventario</h1>
          <p>Todo lo que vendes, listo para su siguiente historia.</p>
        </div>
        <div className="row heading-actions">
          <Button
            variant="outlined"
            startIcon={<Icon name="ai" />}
            disabled={!!cloud && (!cloud.canEdit || cloud.loading || !!cloud.error || !cloud.aiEnabled)}
            onClick={() => setForm('ai')}
          >
            Cargar con IA
          </Button>
          <Button
            variant="contained"
            startIcon={<Icon name="plus" />}
            disabled={!!cloud && (!cloud.canEdit || cloud.loading || !!cloud.error)}
            onClick={() => setForm('manual')}
          >
            Nuevo producto
          </Button>
        </div>
      </div>
      {cloud && !cloud.canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Acceso de solo lectura. Puedes consultar productos; un administrador o editor debe registrar los
          cambios.
        </Alert>
      )}
      <section className="stats-grid">
        <Stat
          label="Productos registrados"
          value={data.products.length}
          note="Piezas únicas en tu catálogo"
          icon="store"
        />
        <Stat
          label="Disponibles"
          value={available.length}
          note="Listos para tu próximo live"
          icon="check"
          tone="green"
        />
        <Stat
          label="En live y reservados"
          value={active.length}
          note="En proceso de venta"
          icon="live"
          tone="amber"
        />
        <Stat
          label="Valor disponible"
          value={currency(available.reduce((s, p) => s + p.price, 0))}
          note="Según precio de venta"
          icon="wallet"
          tone="pink"
        />
      </section>
      <section className="ai-banner">
        <span className="ai-banner-icon">
          <Icon name="ai" size={31} />
        </span>
        <div>
          <span className="mini-title">MENOS CAPTURA, MÁS TIEMPO PARA VENDER</span>
          <h2>
            {cloud && !cloud.aiEnabled
              ? 'IA disponible en la próxima fase'
              : 'Tu próximo producto empieza con una foto.'}
          </h2>
          <p>
            {cloud && !cloud.aiEnabled
              ? 'Puedes seguir registrando y editando productos manualmente.'
              : 'Explora la carga asistida: sube una imagen, revisa los campos y confirma.'}
          </p>
        </div>
        <Button
          disabled={!!cloud && (!cloud.canEdit || cloud.loading || !!cloud.error || !cloud.aiEnabled)}
          onClick={() => setForm('ai')}
          endIcon={<Icon name="arrow" />}
        >
          {cloud && !cloud.aiEnabled ? 'Próximamente' : 'Probar carga con IA'}
        </Button>
        <span className="banner-orbit" aria-hidden="true" />
      </section>
      <section className="panel inventory-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Catálogo de productos <span className="count-pill">{data.products.length}</span>
            </h2>
            <p className="muted small">Consulta, organiza y prepara las piezas que vas a vender.</p>
          </div>
          <div className="view-switch">
            <IconButton
              aria-label="Vista de lista"
              aria-pressed={!grid}
              className={!grid ? 'selected' : ''}
              onClick={() => setGrid(false)}
            >
              <Icon name="list" />
            </IconButton>
            <IconButton
              aria-label="Vista de tarjetas"
              aria-pressed={grid}
              className={grid ? 'selected' : ''}
              onClick={() => setGrid(true)}
            >
              <Icon name="grid" />
            </IconButton>
          </div>
        </div>
        <div className="tabs" role="group" aria-label="Estado de producto">
          {['Todos', 'Disponible', 'En Live', 'Reservado', 'Vendido', 'En revisión'].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              aria-pressed={status === s}
              className={status === s ? 'active' : ''}
            >
              {s === 'Disponible'
                ? 'Disponibles'
                : s === 'Reservado'
                  ? 'Reservados'
                  : s === 'Vendido'
                    ? 'Vendidos'
                    : s}
              {s === 'Todos' && <span>{data.products.length}</span>}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <Search
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Buscar por nombre, código o marca…"
          />
          <div className="filter-select">
            <Field
              select
              label="Tipo de producto"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="Todos">Todos los tipos</MenuItem>
              {[...new Set(data.products.map((p) => p.type))].map((t) => (
                <MenuItem value={t} key={t}>
                  {t}
                </MenuItem>
              ))}
            </Field>
          </div>
        </div>
        {cloud?.loading ? (
          <Empty title="Cargando inventario…" description="Consultando productos de la tienda en Firebase." />
        ) : cloud?.error ? (
          <Empty
            title="No se pudo leer el inventario"
            description={cloud.error}
            action={<Button onClick={cloud.onRetry}>Reintentar</Button>}
          />
        ) : !filtered.length ? (
          <Empty
            title={
              cloud && data.products.length === 0
                ? 'Tu inventario está listo para empezar'
                : 'No encontramos productos'
            }
            description="Prueba otra búsqueda o limpia los filtros para ver tu catálogo."
            action={
              <Button
                onClick={() => {
                  setSearch('');
                  setStatus('Todos');
                  setType('Todos');
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : grid ? (
          <div className="product-grid">
            {shown.map((p) => (
              <button key={p.id} className="product-card" onClick={() => setDetail(p)}>
                <ProductPhoto p={p} />
                <div className="row between">
                  <span className="code">{p.code}</span>
                  <Badge>{p.status}</Badge>
                </div>
                <h3>{p.name}</h3>
                <div className="row between">
                  <span className="muted small">{p.type}</span>
                  <strong>{currency(p.price)}</strong>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PRODUCTO</th>
                  <th>CÓDIGO</th>
                  <th>TIPO</th>
                  <th>COSTO</th>
                  <th>PRECIO DE VENTA</th>
                  <th>ESTADO</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button className="product-cell" onClick={() => setDetail(p)}>
                        <ProductPhoto p={p} />
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.brand || 'Sin marca'} · {p.size || 'Sin talla'}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="code">{p.code}</span>
                    </td>
                    <td className="muted">{p.type}</td>
                    <td className="muted">{currency(p.cost)}</td>
                    <td className="price">{currency(p.price)}</td>
                    <td>
                      <Badge>{p.status}</Badge>
                    </td>
                    <td>
                      <IconButton aria-label={`Ver ${p.code}`} onClick={() => setDetail(p)}>
                        <Icon name="arrow" size={17} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span className="muted small">
            {filtered.length
              ? `${(current - 1) * 6 + 1}–${Math.min(current * 6, filtered.length)} de ${filtered.length} productos`
              : '0 productos'}
          </span>
          <Pagination
            count={pages}
            page={current}
            onChange={(_, p) => setPage(p)}
            size="small"
            color="primary"
            shape="rounded"
          />
        </div>
      </section>
      {form && <ProductForm mode={form} onClose={() => setForm(null)} />}{' '}
      {edit && <ProductForm mode="manual" product={edit} onClose={() => setEdit(null)} />}{' '}
      {detail && (
        <Modal
          title={detail.name}
          subtitle={`${detail.code} · ${detail.type}`}
          onClose={() => setDetail(null)}
        >
          <div className="product-detail">
            <ProductPhoto p={detail} />
            <div>
              <Badge>{detail.status}</Badge>
              {detail.photoPath && !detail.photo && (
                <p className="muted small">Foto no disponible. La referencia se conservará al editar.</p>
              )}
              <h2 className="detail-price">{currency(detail.price)}</h2>
              <p className="muted">{detail.description || 'Sin descripción adicional.'}</p>
              <dl className="detail-list">
                <div>
                  <dt>Marca</dt>
                  <dd>{detail.brand || 'Sin marca'}</dd>
                </div>
                <div>
                  <dt>Talla / tamaño</dt>
                  <dd>{detail.size || 'Sin talla'}</dd>
                </div>
                <div>
                  <dt>Procedencia</dt>
                  <dd>{detail.origin}</dd>
                </div>
                <div>
                  <dt>Costo</dt>
                  <dd>{currency(detail.cost)}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="form-actions">
            {detail.status === 'En revisión' && (!cloud || cloud.canEdit) && (
              <Button
                onClick={() => {
                  setInspect(detail);
                  setDetail(null);
                }}
              >
                Inspeccionar y reintegrar
              </Button>
            )}
            {detail.status === 'Disponible' &&
              (!cloud || (cloud.canEdit && !cloud.loading && !cloud.error)) && (
                <Button
                  onClick={() => {
                    setEdit(detail);
                    setDetail(null);
                  }}
                >
                  Editar producto
                </Button>
              )}
            <Button
              variant="contained"
              onClick={() => {
                setDetail(null);
                if (!cloud) go('live');
              }}
            >
              {cloud ? 'Cerrar detalle' : 'Ir a ventas live'}
            </Button>
          </div>
        </Modal>
      )}
      {inspect && <RestockForm product={inspect} onClose={() => setInspect(null)} />}
    </>
  );
}
function RestockForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const op = useCommerce(`restock.${product.id}`);
  const close = () => {
    if (op.canClose) onClose();
  };
  return (
    <Modal
      title="Inspeccionar producto devuelto"
      subtitle={`${product.code} · ${product.name}`}
      onClose={close}
    >
      <Alert severity="warning">
        Confirma que recibiste la pieza y verificaste que está en condición vendible. Solo entonces volverá a
        estar disponible.
      </Alert>
      <CommerceFeedback op={op} />
      <div className="form-actions">
        <Button disabled={!op.canClose} onClick={close}>
          {op.pending ? 'Cerrar y verificar después' : 'Mantener en revisión'}
        </Button>
        <Button
          variant="contained"
          disabled={op.busy || op.blocked}
          onClick={async () => {
            if (
              await op.run(
                () => ({ kind: 'restock', productId: product.id }),
                (d) => {
                  const p = d.products.find((x) => x.id === product.id);
                  if (!p || p.status !== 'En revisión') throw new Error('La pieza ya no está en revisión.');
                  p.status = 'Disponible';
                },
                'Producto inspeccionado y reintegrado.',
              )
            )
              onClose();
          }}
        >
          {op.label('Confirmar inspección y reintegrar')}
        </Button>
      </div>
    </Modal>
  );
}
function ProductForm({
  mode,
  product,
  onClose,
}: {
  mode: 'manual' | 'ai';
  product?: Product;
  onClose: () => void;
}) {
  const { act, cloud, notify } = useDemo();
  const [draft, setDraft] = useState<ProductDraft>(
    product
      ? { ...product, cost: String(product.cost / 100), price: String(product.price / 100) }
      : { ...emptyDraft },
  );
  const [step, setStep] = useState(mode === 'ai' ? 'source' : 'review');
  const [source, setSource] = useState('');
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const blocked = !!cloud && (!cloud.canEdit || cloud.loading || !!cloud.error);
  const [targetId] = useState(() => product?.id || id());
  const saveOperation = useRef<{
    payload: string;
    id: string;
  } | null>(null);
  const analysisOperation = useRef<{
    payload: string;
    id: string;
  } | null>(null);
  const safeClose = () => {
    if (!saving && !busy) onClose();
  };
  async function analyze() {
    if (cloud && !cloud.aiEnabled) {
      setError('La IA estará disponible en la próxima fase. Puedes continuar con el registro manual.');
      return;
    }
    if (blocked) return;
    setBusy(true);
    setError('');
    try {
      if (cloud) {
        const image = draft.photo.startsWith('data:image/jpeg;base64,') ? draft.photo : '';
        const payload = JSON.stringify({ text: source, image });
        if (analysisOperation.current?.payload !== payload) analysisOperation.current = { payload, id: id() };
        const result = await cloud.analyzeProduct(source, image, analysisOperation.current.id);
        setDraft((d) => ({
          ...d,
          name: result.name || '',
          type: result.type || '',
          brand: result.brand || '',
          size: result.size || '',
          origin: result.origin || '',
          description: result.description || source,
          cost: result.cost === null ? '' : String(result.cost / 100),
          price: result.price === null ? '' : String(result.price / 100),
        }));
        setSample(false);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
        setDraft((d) =>
          sample
            ? {
                name: 'Jirafa de madera',
                type: 'Artesanía',
                brand: 'Colección natural',
                size: 'Única',
                origin: 'Nacional',
                cost: '98',
                price: '245',
                description: source,
                photo: d.photo,
              }
            : { ...emptyDraft, photo: d.photo, description: source },
        );
      }
      setAnalyzed(true);
      setStep('review');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const update = (key: keyof ProductDraft, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    setReading(true);
    try {
      update('photo', await readPhoto(file));
      setSample(false);
      setAnalyzed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (saving) return;
    if (blocked) {
      setError('No puedes guardar mientras se verifica el acceso o el inventario no está disponible.');
      return;
    }
    if (cloud) {
      setSaving(true);
      try {
        const payload = JSON.stringify(draft);
        if (saveOperation.current?.payload !== payload) saveOperation.current = { payload, id: id() };
        const result = await cloud.saveProduct(draft, saveOperation.current.id, product, targetId);
        notify(`Producto ${result.code} guardado en Firebase.`);
        onClose();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (
      act(
        (d) => createProduct(d, draft, product?.id),
        product ? 'Producto actualizado.' : 'Producto registrado y disponible.',
      )
    )
      onClose();
    else setError('Revisa los campos y vuelve a guardar.');
  }
  return (
    <Modal
      title={
        product
          ? 'Editar producto'
          : mode === 'ai'
            ? step === 'source'
              ? 'Cargar producto con IA'
              : 'Revisar borrador'
            : 'Nuevo producto'
      }
      subtitle={
        mode === 'ai'
          ? cloud
            ? cloud.aiEnabled
              ? 'Carga asistida por QwenCloud · Revisa y confirma antes de crear.'
              : 'IA pendiente de la próxima fase · El registro manual está disponible.'
            : 'Simulación de interfaz · QwenCloud aún no está conectado.'
          : 'Cada pieza tendrá un código único generado al guardar.'
      }
      onClose={safeClose}
      wide={step === 'review'}
    >
      {blocked && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          El formulario se conserva, pero el guardado no está disponible. Comprueba tu acceso y la conexión.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {step === 'source' ? (
        <div className="form-stack">
          <Alert severity="info">
            {cloud
              ? cloud.aiEnabled
                ? 'Al analizar se enviarán esta foto y estas notas a QwenCloud. No se crea un producto hasta que revises y confirmes el borrador.'
                : 'QwenCloud no está activo. Conserva tus notas y continúa con el registro manual.'
              : 'Explora el flujo. No se envían fotos ni datos a una IA.'}
          </Alert>
          <label className="upload-zone">
            {draft.photo ? (
              <img src={draft.photo} alt="Foto seleccionada" />
            ) : (
              <>
                <Icon name="upload" size={35} />
                <strong>Selecciona una foto del producto</strong>
                <span>JPG, PNG o WebP · hasta 8 MB</span>
              </>
            )}
            <input
              disabled={saving || busy || reading || blocked}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Subir foto para borrador"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
          <Field
            disabled={saving || busy || blocked}
            label="Descripción o notas del producto"
            multiline
            minRows={3}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setSample(false);
            }}
            placeholder="Marca, tamaño, precio o detalles que ya conozcas…"
          />
          {!cloud && (
            <button
              type="button"
              className="sample-link"
              onClick={() => {
                setSample(true);
                setSource(
                  'Jirafa de madera artesanal, Colección natural, tamaño único. Costo Q98 y precio Q245. Procedencia nacional.',
                );
                update('photo', '/images/products/product-1.jpg');
              }}
            >
              Usar un producto de ejemplo
            </button>
          )}
          <button
            type="button"
            className="sample-link"
            disabled={busy}
            onClick={() => {
              setDraft((d) => ({ ...d, description: source }));
              setStep('review');
            }}
          >
            Continuar con registro manual
          </button>
          <div className="form-actions">
            <Button color="inherit" onClick={safeClose}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              startIcon={busy ? <CircularProgress size={17} color="inherit" /> : <Icon name="ai" />}
              disabled={
                busy ||
                reading ||
                blocked ||
                (!!cloud && !cloud.aiEnabled) ||
                (!source.trim() && !draft.photo)
              }
              onClick={() => void analyze()}
            >
              {busy ? 'Preparando borrador…' : cloud ? 'Analizar con QwenCloud' : 'Ver borrador de ejemplo'}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="form-stack">
          {mode === 'ai' && (
            <Alert severity="warning">
              {cloud
                ? analyzed
                  ? 'Borrador de QwenCloud. Verifica los datos; completa los campos que no pudo determinar.'
                  : 'Registro manual. La foto no fue analizada; completa y verifica los datos antes de guardar.'
                : sample
                  ? 'Borrador de ejemplo precargado. Revisa todos los campos antes de guardar.'
                  : 'La foto no fue analizada. Completa los campos pendientes; el análisis real llegará con QwenCloud.'}
            </Alert>
          )}
          <div className="product-form-grid">
            <div>
              <label className="upload-zone review-upload">
                {draft.photo ? (
                  <img src={draft.photo} alt="Fotografía del producto" />
                ) : (
                  <>
                    <Icon name="upload" size={32} />
                    <strong>Agregar fotografía</strong>
                    <span>Opcional · JPG, PNG o WebP</span>
                  </>
                )}
                <input
                  disabled={saving || busy || reading || blocked}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Fotografía del producto"
                  onChange={(e) => void upload(e.target.files?.[0])}
                />
              </label>
              <p className="muted small">Código y estado Disponible se asignan al guardar.</p>
            </div>
            <div className="form-stack">
              <Field
                disabled={saving || busy || blocked}
                label="Nombre del producto"
                required
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                inputProps={{ maxLength: 100 }}
              />
              <div className="form-two">
                <Field
                  disabled={saving || busy || blocked}
                  select
                  required
                  label="Tipo de producto"
                  value={draft.type}
                  onChange={(e) => update('type', e.target.value)}
                >
                  {['Artesanía', 'Decoración', 'Ropa', 'Calzado', 'Accesorio', 'Otro'].map((x) => (
                    <MenuItem key={x} value={x}>
                      {x}
                    </MenuItem>
                  ))}
                </Field>
                <Field
                  disabled={saving || busy || blocked}
                  select
                  required
                  label="Procedencia"
                  value={draft.origin}
                  onChange={(e) => update('origin', e.target.value)}
                >
                  {['Nacional', 'Importado', 'Segunda mano', 'Otro'].map((x) => (
                    <MenuItem key={x} value={x}>
                      {x}
                    </MenuItem>
                  ))}
                </Field>
              </div>
              <div className="form-two">
                <Field
                  disabled={saving || busy || blocked}
                  label="Marca"
                  value={draft.brand}
                  onChange={(e) => update('brand', e.target.value)}
                />
                <Field
                  disabled={saving || busy || blocked}
                  label="Talla / tamaño"
                  value={draft.size}
                  onChange={(e) => update('size', e.target.value)}
                />
              </div>
              <div className="form-two">
                <Field
                  disabled={saving || busy || blocked}
                  label="Costo (Q)"
                  required
                  value={draft.cost}
                  inputProps={{ inputMode: 'decimal' }}
                  onChange={(e) => update('cost', e.target.value)}
                />
                <Field
                  disabled={saving || busy || blocked}
                  label="Precio de venta (Q)"
                  required
                  value={draft.price}
                  inputProps={{ inputMode: 'decimal' }}
                  onChange={(e) => update('price', e.target.value)}
                />
              </div>
              <Field
                disabled={saving || busy || blocked}
                label="Descripción"
                multiline
                minRows={3}
                value={draft.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </div>
          </div>
          <Actions
            onClose={safeClose}
            label={
              saving
                ? 'Guardando en Firebase…'
                : product
                  ? 'Guardar cambios'
                  : mode === 'ai'
                    ? 'Confirmar y crear producto'
                    : 'Guardar producto'
            }
            disabled={reading || saving || busy || blocked}
          />
        </form>
      )}
    </Modal>
  );
}
