import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
const env = import.meta.env;
export const qwenEnabled = env.VITE_ENABLE_QWENCLOUD === 'true';
export const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true';
export const storeId = env.VITE_FIREBASE_STORE_ID || '';
export const storeName = env.VITE_FIREBASE_STORE_NAME || storeId;
const values = {
  VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_STORE_ID: storeId,
  ...(useEmulators ? {} : { VITE_FIREBASE_APP_CHECK_SITE_KEY: env.VITE_FIREBASE_APP_CHECK_SITE_KEY }),
};
export const missingConfig = Object.entries(values)
  .filter(([, v]) => typeof v !== 'string' || !v.trim() || v.includes('YOUR_PROJECT'))
  .map(([k]) => k);
export type FirebaseClient = ReturnType<typeof createClient>;
let instance: FirebaseClient | null = null;
function createClient() {
  if (missingConfig.length) throw new Error('Completa la configuración pública de Firebase.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(storeId)) throw new Error('El identificador de tienda no es válido.');
  if (
    useEmulators &&
    (!['localhost', '127.0.0.1'].includes(location.hostname) ||
      env.VITE_FIREBASE_PROJECT_ID !== 'demo-hackaton')
  )
    throw new Error('Los emuladores solo se usan en localhost con el proyecto demo-hackaton.');
  if (!useEmulators && env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-'))
    throw new Error('Un proyecto demo requiere emuladores habilitados.');
  const app =
    getApps()[0] ||
    initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      appId: env.VITE_FIREBASE_APP_ID,
    });
  if (!useEmulators)
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(env.VITE_FIREBASE_APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  const auth = getAuth(app),
    db = getFirestore(app),
    storage = getStorage(app),
    functions = getFunctions(app, env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1');
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8085);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  return { app, auth, db, storage, functions };
}
export function firebaseClient() {
  if (!instance) instance = createClient();
  return instance;
}
export async function login(email: string, password: string) {
  await signInWithEmailAndPassword(firebaseClient().auth, email.trim(), password);
}
export async function logout() {
  await signOut(firebaseClient().auth);
}
export function firebaseMessage(error: unknown) {
  const code = (error as { code?: string })?.code || '';
  const known: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/user-disabled': 'Esta cuenta está deshabilitada. Contacta al administrador.',
    'auth/too-many-requests': 'Demasiados intentos. Espera antes de volver a entrar.',
    'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión y reintenta.',
    'permission-denied': 'No tienes permiso para leer el inventario de esta tienda.',
    'functions/unauthenticated': 'La sesión expiró. Vuelve a entrar para guardar.',
    'functions/permission-denied': 'Tu cuenta no tiene permiso para modificar este inventario.',
    'functions/unavailable': 'No se pudo completar la solicitud. Conserva el formulario y reintenta.',
    'functions/not-found': 'La función no está disponible. Verifica su despliegue y región.',
  };
  if (known[code]) return known[code];
  if (code.startsWith('functions/') && typeof (error as Error).message === 'string')
    return (error as Error).message;
  return 'No se pudo completar la operación. Revisa la configuración y reintenta.';
}
