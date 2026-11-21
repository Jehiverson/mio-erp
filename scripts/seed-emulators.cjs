// Sólo datos ficticios en emuladores locales. Nunca usa el proyecto real.
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
for (const [name, host] of Object.entries({
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
})) {
  if (process.env[name] && process.env[name] !== host) throw Error(`Este seed sólo admite ${name}=${host}`);
  process.env[name] = host;
}
initializeApp({ projectId: 'demo-hackaton' });
(async () => {
  const users = [
    { uid: 'demo-admin', email: 'admin@example.test', role: 'admin' },
    { uid: 'demo-editor', email: 'editor@example.test', role: 'editor' },
    { uid: 'demo-viewer', email: 'viewer@example.test', role: 'viewer' },
    { uid: 'demo-denied', email: 'sin-acceso@example.test', role: null },
  ];
  for (const user of users) {
    try {
      await getAuth().getUser(user.uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      await getAuth().createUser({ uid: user.uid, email: user.email, password: 'Demo-Only-321!' });
    }
    if (user.role)
      await getFirestore().doc(`stores/principal/members/${user.uid}`).set({ active: true, role: user.role });
  }
  console.log(
    'Usuarios ficticios en demo-hackaton: admin@example.test, editor@example.test, viewer@example.test y sin-acceso@example.test. Contraseña de prueba: Demo-Only-321!',
  );
})().catch((e) => {
  console.error(
    'No se pudo preparar el emulador. Verifica que npm run emulators esté activo.',
    e.code || e.message,
  );
  process.exitCode = 1;
});
