#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project='project-97ed847a-4800-435a-b4a'
account='skepcodegt@gmail.com'
# Ejecutar desde la Terminal del usuario: los CLI necesitan renovar sus sesiones.
firebase login --reauth
firebase apps:list WEB --project "$project" --account "$account"
gcloud auth print-access-token --account="$account" >/dev/null

# La clave se entrega por stdin, nunca como argumento ni en el bundle web.
node --input-type=module <<'NODE' | firebase functions:secrets:set QWENCLOUD_API_KEY --data-file=- --project "$project" --account "$account"
import fs from 'node:fs';
const text = fs.readFileSync('apps/functions/.secret.local', 'utf8');
const key = text.match(/^QWENCLOUD_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('Falta la clave local de Qwen.');
process.stdout.write(key);
NODE
bash scripts/deploy-phase3.sh
node scripts/prepare-demo-operator.mjs
