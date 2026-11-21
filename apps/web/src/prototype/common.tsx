import { createContext, useContext, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  type TextFieldProps,
} from '@mui/material';
import NiStore from '../icons/nexture/ni-store';
import NiScreen from '../icons/nexture/ni-screen';
import NiTruck from '../icons/nexture/ni-truck';
import NiMagicWand from '../icons/nexture/ni-magic-wand';
import NiPlus from '../icons/nexture/ni-plus';
import NiSearch from '../icons/nexture/ni-search';
import NiArrowRight from '../icons/nexture/ni-arrow-right';
import NiCross from '../icons/nexture/ni-cross';
import NiCheck from '../icons/nexture/ni-check';
import NiWallet from '../icons/nexture/ni-wallet';
import NiUploadCloud from '../icons/nexture/ni-upload-cloud';
import NiMenu from '../icons/nexture/ni-menu';
import NiUsers from '../icons/nexture/ni-users';
import NiArrowHistory from '../icons/nexture/ni-arrow-history';
import NiLayout from '../icons/nexture/ni-layout';
import NiList from '../icons/nexture/ni-list';
import type { Demo, Product, ProductDraft } from './model';
import type { AiDraft } from '@hackaton/shared';
export const icons = {
  store: NiStore,
  live: NiScreen,
  truck: NiTruck,
  ai: NiMagicWand,
  plus: NiPlus,
  search: NiSearch,
  arrow: NiArrowRight,
  close: NiCross,
  check: NiCheck,
  wallet: NiWallet,
  upload: NiUploadCloud,
  menu: NiMenu,
  users: NiUsers,
  reset: NiArrowHistory,
  grid: NiLayout,
  list: NiList,
};
export function Icon({ name, size = 20 }: { name: keyof typeof icons; size?: number }) {
  const C = icons[name];
  return (
    <span className="icon" aria-hidden="true">
      <C size={size} />
    </span>
  );
}
export type Page = 'inventario' | 'live' | 'entregas';
export type DemoContextType = {
  data: Demo;
  notify: (message: string) => void;
  cloud?: {
    aiEnabled: boolean;
    canEdit: boolean;
    loading: boolean;
    error: string;
    saveProduct: (
      draft: ProductDraft,
      operation: string,
      previous: Product | undefined,
      targetId: string,
    ) => Promise<{ code: string }>;
    analyzeProduct: (text: string, image: string, operation: string) => Promise<AiDraft>;
    onRetry: () => void;
  };
  act: (fn: (d: Demo) => void, message?: string) => boolean;
  go: (page: Page, orderId?: string) => void;
  orderId: string | null;
  setOrderId: (id: string | null) => void;
};
export const DemoContext = createContext<DemoContextType | null>(null);
export const useDemo = () => useContext(DemoContext)!;
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const text = typeof children === 'string' ? children : '';
  const color =
    tone ||
    (text === 'Disponible' || text === 'Pagado' || text === 'Entregado'
      ? 'green'
      : text === 'Reservado' || text === 'Pago parcial' || text === 'Pendiente de pago'
        ? 'amber'
        : text === 'Devuelto' || text === 'En revisión' || text === 'Reembolso pendiente'
          ? 'red'
          : text === 'Enviado' || text === 'En Live'
            ? 'purple'
            : 'gray');
  return (
    <span className={`badge ${color}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth={wide ? 'md' : 'sm'}
      className="prototype-modal"
      aria-labelledby="modal-title"
    >
      <DialogTitle id="modal-title" component="div">
        <div className="row between">
          <h2>{title}</h2>
          <IconButton aria-label="Cerrar ventana" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </div>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}
export function Field(props: TextFieldProps) {
  return <TextField size="small" fullWidth {...props} />;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name="store" size={28} />
      </div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search">
      <Icon name="search" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" aria-label="Limpiar búsqueda" onClick={() => onChange('')}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  icon,
  tone = 'purple',
}: {
  label: string;
  value: string | number;
  note: string;
  icon: keyof typeof icons;
  tone?: string;
}) {
  return (
    <div className="stat">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span className="muted small">{note}</span>
      </div>
      <span className={`stat-icon ${tone}`}>
        <Icon name={icon} size={23} />
      </span>
    </div>
  );
}
export function Actions({
  onClose,
  label = 'Guardar',
  disabled = false,
}: {
  onClose: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="form-actions">
      <Button onClick={onClose} color="inherit">
        Cancelar
      </Button>
      <Button type="submit" variant="contained" disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}
export async function readPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Selecciona una foto JPG, PNG o WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('La foto no debe superar 8 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.75);
}
