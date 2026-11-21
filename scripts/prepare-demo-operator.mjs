import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = 'project-97ed847a-4800-435a-b4a';
const account = 'skepcodegt@gmail.com';
// Firebase Admin usa este valor para enviar x-goog-user-project con OAuth de usuario.
process.env.GOOGLE_CLOUD_QUOTA_PROJECT = projectId;
initializeApp({ projectId, credential: {
  async getAccessToken() {
    const access_token = execFileSync('gcloud', ['auth', 'print-access-token', `--account=${account}`], { encoding: 'utf8' }).trim();
    return { access_token, expires_in: 3000 };
  },
} });
const auth = getAuth();
const requestedPassword = process.env.DEMO_OPERATOR_PASSWORD;
if (requestedPassword !== undefined && requestedPassword.length < 6) {
  throw new Error('La contraseña de la demo debe tener al menos seis caracteres.');
}
let user;
try { user = await auth.getUserByEmail('test@test.com'); }
catch (error) {
  if (error.code !== 'auth/user-not-found') throw error;
  const password = requestedPassword || randomBytes(18).toString('base64url');
  user = await auth.createUser({ email: 'test@test.com', password });
  console.log('Operador creado: test@test.com');
  console.log(`Contraseña de la demo (guárdala): ${password}`);
}
if (user.disabled) throw new Error('El operador está deshabilitado; revisar Authentication.');
if (requestedPassword) {
  await auth.updateUser(user.uid, { password: requestedPassword });
  console.log('Contraseña solicitada actualizada para test@test.com.');
}
if (process.argv.includes('--password-only')) {
  if (!requestedPassword) throw new Error('Falta DEMO_OPERATOR_PASSWORD.');
  process.exit(0);
}
const accessToken = execFileSync('gcloud', ['auth', 'print-access-token', `--account=${account}`], { encoding: 'utf8' }).trim();
const memberUrl = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stores/principal/members/${encodeURIComponent(user.uid)}`);
memberUrl.searchParams.append('updateMask.fieldPaths', 'active');
memberUrl.searchParams.append('updateMask.fieldPaths', 'role');
const response = await fetch(memberUrl, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'x-goog-user-project': projectId,
  },
  body: JSON.stringify({ fields: { active: { booleanValue: true }, role: { stringValue: 'editor' } } }),
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) {
  const failure = await response.json().catch(() => ({}));
  throw new Error(`No se pudo guardar la membresía (${response.status}): ${failure.error?.message || response.statusText}`);
}
console.log('Membresía editor verificada para test@test.com. Si ya existía, conserva su contraseña.');
