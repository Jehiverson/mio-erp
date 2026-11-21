// Comprobación local sin red, escritura ni salida de valores de configuración.
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const project = 'project-97ed847a-4800-435a-b4a';
const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}
function json(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}
function envFiles(paths) {
  const env = {};
  for (const path of paths) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) continue;
    for (const line of readFileSync(absolute, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let value = match[2];
      if (/^["']/.test(value)) value = value.slice(1, value.lastIndexOf(value[0]));
      else value = value.replace(/\s+#.*$/, '');
      env[match[1]] = value;
    }
  }
  return { ...env, ...process.env };
}
try {
  const web = envFiles([
    'apps/web/.env',
    'apps/web/.env.local',
    'apps/web/.env.production',
    'apps/web/.env.production.local',
  ]);
  const backend = envFiles([
    'apps/functions/.env',
    'apps/functions/.env.hackaton',
    `apps/functions/.env.${project}`,
  ]);
  for (const name of [
    'API_KEY',
    'AUTH_DOMAIN',
    'PROJECT_ID',
    'STORAGE_BUCKET',
    'APP_ID',
    'APP_CHECK_SITE_KEY',
    'STORE_ID',
  ]) {
    const value = web[`VITE_FIREBASE_${name}`];
    expect(
      typeof value === 'string' && value.trim() && !value.includes('YOUR_PROJECT'),
      `Falta configuración web válida: VITE_FIREBASE_${name}`,
    );
  }
  expect(web.VITE_FIREBASE_PROJECT_ID === project, 'El proyecto web no coincide con nineshop.');
  expect(
    web.VITE_FIREBASE_AUTH_DOMAIN === `${project}.firebaseapp.com`,
    'El dominio de Authentication no coincide.',
  );
  expect(web.VITE_FIREBASE_STORAGE_BUCKET === `${project}.firebasestorage.app`, 'El bucket web no coincide.');
  expect(web.VITE_FIREBASE_STORE_ID === 'principal', 'La tienda de esta fase debe ser principal.');
  expect(
    web.VITE_FIREBASE_FUNCTIONS_REGION === 'us-central1' && backend.FUNCTIONS_REGION === 'us-central1',
    'Las regiones deben coincidir en us-central1.',
  );
  expect(
    web.VITE_USE_FIREBASE_EMULATORS === 'false',
    'El build de despliegue debe tener emuladores desactivados.',
  );
  expect(
    ['true', 'false'].includes(web.VITE_ENABLE_QWENCLOUD) && web.VITE_ENABLE_QWENCLOUD === backend.ENABLE_QWENCLOUD,
    'QwenCloud debe tener el mismo estado válido en web y backend.',
  );
  expect(
    backend.PRODUCT_STORAGE_BUCKET === web.VITE_FIREBASE_STORAGE_BUCKET,
    'El bucket backend y web deben coincidir.',
  );
  expect(
    !Object.keys(web).some(
      (key) => key.startsWith('VITE_') && /SECRET|PRIVATE_KEY|QWENCLOUD_API_KEY/.test(key),
    ),
    'Hay un nombre de variable secreta expuesto con prefijo VITE_.',
  );
  const config = json('firebase.json');
  expect(
    json('.firebaserc').projects.default === project,
    'El proyecto Firebase predeterminado no coincide.',
  );
  expect(
    config.functions.length === 1 && config.functions[0].codebase === 'hackaton',
    'El despliegue debe usar sólo el codebase hackaton.',
  );
  expect(config.functions[0].runtime === 'nodejs22', 'El runtime esperado de Functions es Node.js 22.');
  expect(config.hosting.public === 'apps/web/dist', 'Hosting debe publicar apps/web/dist.');
  const cors = json('cors.firebase.json');
  expect(
    cors.length === 1 && cors[0].method.length === 1 && cors[0].method[0] === 'GET',
    'CORS debe permitir sólo GET.',
  );
  expect(
    JSON.stringify([...cors[0].origin].sort()) ===
      JSON.stringify([`https://${project}.web.app`, `https://${project}.firebaseapp.com`].sort()),
    'CORS debe limitarse a los dos dominios de Hosting.',
  );
} catch (error) {
  failures.push(`No se pudo leer la configuración: ${error.code || error.name}`);
}
if (failures.length) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Configuración local de despliegue correcta.');
  console.log('No verifica credenciales, membresías, reglas publicadas ni servicios remotos.');
}
