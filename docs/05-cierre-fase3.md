# Cierre de fase 3: inventario real

## Estado verificado

Proyecto nineshop: project-97ed847a-4800-435a-b4a. Cuenta de despliegue: skepcodegt@gmail.com.
App web, Authentication por correo/contraseña, Firestore Standard y Storage en us-central1 configurados.
App Check Enterprise registrado; la clave pública está en el archivo local ignorado. QwenCloud sigue apagado.

No hay despliegue ni prueba real completados. Authentication todavía muestra cero usuarios tras recargar la tabla. El primer commit ya existe en main: 04d22bd (feat: add MVP monorepo and Firebase inventory integration). El árbol estaba limpio al reanudar. La sesión Firebase CLI ya funciona: apps:list devolvió la aplicación activa. El intento de desplegar reglas se detuvo al guardar la caché de APIs habilitadas en ~/.config/configstore (EPERM), antes de publicar reglas. Este bloqueo exige ejecutar el CLI desde la Terminal del usuario; no es necesario repetir el login. No copiar credenciales para eludir esa restricción.

## Comando único desde la Terminal del equipo

```bash
cd /Users/jehi/Desktop/Hackaton
bash scripts/deploy-phase3.sh
```

El script ejecuta comprobación local, pruebas, build y consulta de acceso. Verifica que el bucket no tenga una política CORS diferente antes de publicar reglas, las tres funciones del codebase hackaton (inventario, análisis desactivado y comercio), CORS y Hosting. Se detiene ante cualquier error. No crea usuarios, membresías, secretos de QwenCloud ni commits. Los comandos individuales se detallan abajo para revisar el alcance.

## Verificación y commits posteriores desde la Terminal del equipo

Ejecutar desde /Users/jehi/Desktop/Hackaton. La comprobación local no imprime claves ni consulta la nube.

```bash
cd /Users/jehi/Desktop/Hackaton
npm run check:phase3
npm test
npm run build
git add .
git diff --cached --stat
git diff --cached --name-only -- .env ':(glob)**/.env' ':(glob)**/.env.*' ':(glob)**/.secret*'
```

La última consulta sólo debe listar archivos de ejemplo .env.example; ningún archivo local ni secreto. Revisar los cambios preparados antes del commit:

```bash
git commit -m "docs: update Firebase phase 3 deployment status"
git status --short --branch
```

No se configura remoto ni se hace push. El commit incluye el gateway de QwenCloud desactivado y las demos de Live/Entregas; esos módulos todavía no están conectados a Firebase.

## Operador y membresía

1. El usuario introduce y guarda la contraseña en Authentication → Usuarios → Agregar usuario para test@test.com.
2. Obtener su UID real desde la tabla; no usar el correo como ID del documento.
3. En Firestore, crear el documento stores/principal/members/UID con los campos active (boolean) true y role (string) editor. Este permiso permite probar altas/ediciones en la tienda principal; no concede administración del proyecto ni acceso a otras tiendas. No guardar la contraseña en Firestore.

La creación de esta membresía sigue pendiente y debe verificarse antes de probar acceso. No se crea ninguna membresía sin el UID real del usuario.

## Desplegar servicios del inventario

Si Firebase CLI necesita renovar la sesión, hacerlo en la Terminal del usuario:

```bash
firebase login --reauth
firebase apps:list WEB --project project-97ed847a-4800-435a-b4a --account skepcodegt@gmail.com
```

Si esa cuenta no figura en firebase login:list, usar firebase login:add y seleccionar skepcodegt@gmail.com. Mantener el proyecto y la cuenta explícitos en todos los comandos.

Primero desplegar reglas e índices:

```bash
firebase deploy --only firestore,storage --project project-97ed847a-4800-435a-b4a --account skepcodegt@gmail.com
```

Storage consulta membresías en Firestore. Si Firebase solicita habilitar esa integración, revisar la solicitud para el servicio de Storage de este proyecto; no sustituir las reglas por acceso abierto.

Después desplegar las tres funciones de este MVP una por una, sin --force. El primer aprovisionamiento del bucket de fuentes de Google puede devolver HTTP 409 si varias funciones intentan crearlo simultáneamente:

```bash
firebase deploy --only functions:hackaton:saveInventoryProduct --project project-97ed847a-4800-435a-b4a --account skepcodegt@gmail.com
firebase deploy --only functions:hackaton:executeCommerce --project project-97ed847a-4800-435a-b4a --account skepcodegt@gmail.com
firebase deploy --only functions:hackaton:analyzeInventoryProduct --project project-97ed847a-4800-435a-b4a --account skepcodegt@gmail.com
```

Los parámetros locales están en apps/functions/.env.project-97ed847a-4800-435a-b4a. ENABLE_QWENCLOUD=false: no es necesario crear ni proporcionar un secreto de QwenCloud. Si aparece un error de despliegue, conservar su mensaje y resolverlo antes de publicar Hosting.

Aplicar CORS al bucket nuevo de fotos. Este comando reemplaza su configuración CORS; leer la configuración actual primero y conservar cualquier origen legítimo añadido posteriormente:

```bash
gcloud storage buckets describe gs://project-97ed847a-4800-435a-b4a.firebasestorage.app --account=skepcodegt@gmail.com --format="json(cors_config)"
gcloud storage buckets update gs://project-97ed847a-4800-435a-b4a.firebasestorage.app --cors-file=cors.firebase.json --account=skepcodegt@gmail.com
```

cors.firebase.json permite GET sólo desde los dos dominios de Hosting. CORS no reemplaza autorización ni vuelve públicas las fotos.

Finalmente publicar la web compilada:

```bash
npm run check:phase3
npm run build
firebase deploy --only hosting --project project-97ed847a-4800-435a-b4a --account skepcodegt@gmail.com
```

Abrir https://project-97ed847a-4800-435a-b4a.web.app. La clave Enterprise está limitada a estos dominios; el flujo con servicios reales no se debe probar desde localhost con esta clave. Para pruebas locales, usar el proyecto demo-hackaton y sus emuladores.

## Criterios para cerrar la fase

- Ingresar como operador activo y consultar inventario sin errores.
- Crear una pieza manual con foto, recargar y comprobar código, importes y foto persistidos.
- Editar una pieza disponible y comprobar persistencia; preservar datos ante error/reintento.
- Probar conflicto de revisión en dos pestañas y reintento de una operación sin duplicar producto.
- Verificar que un usuario sin membresía no lee ni escribe y que viewer no puede guardar.
- Verificar que las fotos no se leen sin autorización.
- Confirmar que IA está desactivada. Live y Entregas ya están implementados en la siguiente fase; su validación real se detalla en docs/06-live-entregas-pagos.md.

Las pruebas unitarias no sustituyen estos criterios. Registrar sus resultados antes de iniciar Live/pagos reales.

Fuentes: https://firebase.google.com/docs/functions/organize-functions y https://cloud.google.com/storage/docs/using-cors.
