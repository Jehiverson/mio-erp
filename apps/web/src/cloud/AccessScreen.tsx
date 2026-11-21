import { useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Divider,
  InputAdornment,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material';
import NiStore from '../icons/nexture/ni-store';
import { brand } from '../prototype/brand';

type AccessScreenProps = {
  missing: string[];
  loading: boolean;
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onDemo: () => void;
};

export default function AccessScreen({ missing, loading, error, onLogin, onDemo }: AccessScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const busy = loading || submitting;
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          primary: { main: brand.accent, contrastText: brand.cream },
          secondary: { main: brand.orange, contrastText: '#182e40' },
          background: { default: brand.cream, paper: '#ffffff' },
          text: { primary: brand.ink, secondary: brand.muted },
        },
        typography: {
          fontFamily: '"Mulish", "Avenir Next", Arial, sans-serif',
          button: { textTransform: 'none', fontWeight: 700 },
        },
        shape: { borderRadius: 12 },
        components: {
          MuiButton: { defaultProps: { disableElevation: true } },
        },
      }),
    [],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || missing.length) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onLogin(email.trim(), password);
    } catch {
      setSubmitError('No se pudo iniciar sesión. Revisa tus datos y vuelve a intentarlo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        component="main"
        sx={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          p: { xs: 2, sm: 4 },
          bgcolor: 'background.default',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 1000,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '0.95fr 1.05fr' },
            bgcolor: 'background.paper',
            border: '1px solid #e8e3ee',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <Box
            component="section"
            aria-label="Tu espacio de trabajo"
            sx={{ p: { xs: 3, sm: 4.5 }, bgcolor: brand.accent, color: brand.cream, position: 'relative', overflow: 'hidden' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: { xs: 3, md: 8 } }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 3,
                  bgcolor: brand.accent,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt="" width="36" height="36" style={{ objectFit: 'contain' }} />
                ) : (
                  <NiStore size={27} />
                )}
              </Box>
              <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <Typography sx={{ fontSize: 22, fontWeight: 750, lineHeight: 1.3 }}>{brand.name}</Typography>
                <Typography sx={{ fontSize: 12, color: brand.cream, mt: 0.3 }}>
                  {brand.subtitle}
                </Typography>
              </Box>
            </Box>
            <Typography
              component="h2"
              sx={{ fontSize: { xs: 27, md: 34 }, fontWeight: 750, lineHeight: 1.25, mb: 2, color: brand.cream }}
            >
              Del primer producto a la última entrega.
            </Typography>
            <Typography sx={{ fontSize: 14, color: brand.cream, lineHeight: 1.8 }}>
              Inventario, ventas live y entregas en un mismo espacio para tu equipo.
            </Typography>
            <Box sx={{ mt: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ width: 45, height: 7, borderRadius: 4, bgcolor: brand.orange, mb: 2 }} />
              <Box component="img" src={brand.mascotUrl} alt="Mascota de Mio" sx={{ width: { xs: 110, md: 180 }, height: { xs: 120, md: 195 }, objectFit: 'contain' }} />
            </Box>
          </Box>

          <Box component="section" aria-labelledby="access-title" sx={{ p: { xs: 3, sm: 4.5 } }}>
            <Typography
              component="h1"
              id="access-title"
              sx={{ fontSize: 27, fontWeight: 750, lineHeight: 1.3, mb: 1 }}
            >
              {missing.length ? 'Conexión pendiente' : 'Entra a tu tienda'}
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.7, mb: 3 }}>
              {missing.length
                ? 'Falta completar la configuración de Firebase para acceder con tu cuenta.'
                : 'Usa el correo y la contraseña de tu cuenta autorizada.'}
            </Typography>

            {(error || submitError) && (
              <Alert severity="error" sx={{ mb: 2, overflowWrap: 'anywhere' }}>
                {error || submitError}
              </Alert>
            )}

            {missing.length ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography component="p" sx={{ fontSize: 13, fontWeight: 700 }}>
                  Configuración por completar
                </Typography>
                <Box component="ul" sx={{ m: 0, mt: 1, pl: 2 }}>
                  {missing.map((name) => (
                    <Box component="li" key={name} sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                      <Box component="code" sx={{ fontSize: 12 }}>
                        {name}
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Typography sx={{ fontSize: 13, mt: 1.5, lineHeight: 1.7 }}>
                  El responsable de la instalación debe completar estos ajustes y volver a cargar la
                  aplicación. Mientras tanto, puedes explorar la demo local.
                </Typography>
              </Alert>
            ) : (
              <Box component="form" onSubmit={submit} aria-busy={busy} sx={{ display: 'grid', gap: 2.5 }}>
                <TextField
                  label="Correo electrónico"
                  type="email"
                  autoComplete="email"
                  required
                  fullWidth
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  inputProps={{ autoCapitalize: 'none', spellCheck: false }}
                />
                <TextField
                  label="Contraseña"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  fullWidth
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          type="button"
                          size="small"
                          onClick={() => setVisible((value) => !value)}
                          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          aria-pressed={visible}
                          disabled={busy}
                          sx={{ minWidth: 0, px: 0.5, fontSize: 12 }}
                        >
                          {visible ? 'Ocultar' : 'Mostrar'}
                        </Button>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={busy}
                  startIcon={busy ? <CircularProgress size={17} color="inherit" /> : undefined}
                  sx={{ minHeight: 46 }}
                >
                  {busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
                </Button>
              </Box>
            )}

            <Divider sx={{ my: 3 }} />
            <Button type="button" variant="outlined" fullWidth onClick={onDemo} sx={{ minHeight: 46 }}>
              Explorar demo local
            </Button>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.8, mt: 1.5 }}>
              La demo utiliza datos de ejemplo guardados solo en este navegador. No inicia sesión ni modifica
              los datos de tu tienda en Firebase.
            </Typography>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
