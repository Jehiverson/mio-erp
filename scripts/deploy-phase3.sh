#!/usr/bin/env bash
# Ejecutar en la Terminal del equipo: bash scripts/deploy-phase3.sh
set -euo pipefail
cd "$(dirname "$0")/.."

phase3_project='project-97ed847a-4800-435a-b4a'
phase3_account='skepcodegt@gmail.com'
phase3_bucket="gs://${phase3_project}.firebasestorage.app"

command -v firebase >/dev/null
command -v gcloud >/dev/null
command -v node >/dev/null

npm run check:phase3
npm test
npm run build

# Primero verificar acceso, sin cambiar la cuenta predeterminada.
firebase apps:list WEB --project "$phase3_project" --account "$phase3_account"

# Leer CORS antes de aplicar la política al bucket del MVP. Detenerse si alguien
# añadió una configuración diferente; no sobrescribirla silenciosamente.
phase3_cors_file="$(mktemp "${TMPDIR:-/tmp}/hackaton-cors.XXXXXX")"
trap 'rm -f "$phase3_cors_file"' EXIT
gcloud storage buckets describe "$phase3_bucket" \
  --account="$phase3_account" --format='json(cors_config)' > "$phase3_cors_file"
node - "$phase3_cors_file" <<'NODE'
const fs = require('node:fs');
const actual = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).cors_config || [];
const expected = JSON.parse(fs.readFileSync('cors.firebase.json', 'utf8'));
function canonical(rules) {
  return JSON.stringify(rules.map((rule) => ({
    origin: [...(rule.origin || [])].sort(),
    method: [...(rule.method || [])].sort(),
    responseHeader: [...(rule.responseHeader || rule.response_header || [])].sort(),
    maxAgeSeconds: rule.maxAgeSeconds ?? rule.max_age_seconds,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
if (actual.length && canonical(actual) !== canonical(expected)) {
  console.error('El bucket ya tiene una política CORS diferente. Revisarla antes de continuar. No se modificó.');
  process.exit(1);
}
NODE

firebase deploy --only firestore,storage \
  --project "$phase3_project" --account "$phase3_account"
firebase deploy \
  --only functions:hackaton:saveInventoryProduct,functions:hackaton:analyzeInventoryProduct,functions:hackaton:executeCommerce \
  --project "$phase3_project" --account "$phase3_account"
gcloud storage buckets update "$phase3_bucket" \
  --cors-file=cors.firebase.json --account="$phase3_account"
firebase deploy --only hosting \
  --project "$phase3_project" --account "$phase3_account"

echo 'Despliegue completado. QwenCloud sigue desactivado.'
echo "Abrir https://${phase3_project}.web.app"
echo 'Pendiente validar usuario/membresía y probar inventario/fotos contra Firebase.'
