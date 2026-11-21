# Fase 3 · Firebase e inventario asistido con QwenCloud

Estado al 21 de noviembre de 2026: Firebase habilitado, app web registrada y configuración pública guardada localmente. Authentication con correo/contraseña habilitado. Firestore Standard (default) y bucket predeterminado creados en us-central1, con reglas iniciales que deniegan todo acceso del cliente. App Check Enterprise registrado con TTL de una hora y clave pública configurada localmente. Pendientes: primer operador con membresía, despliegue y pruebas reales. QwenCloud sigue desactivado hasta la siguiente fase por decisión del usuario.

## Qué cambió
- La entrada predeterminada muestra acceso a Firebase, o explica qué configuración pública falta. La demo local sigue disponible mediante una acción explícita y no se mezcla con datos de nube.
- Autenticación por correo/contraseña de operadores existentes; no hay registro público. La cuenta requiere membresía activa en la tienda configurada.
- Inventario conectado a Firestore: últimas 200 piezas, altas, edición de piezas disponibles y fotos privadas en Storage. Live y Entregas siguen como próximas fases dentro del modo nube; permanecen operativos en la demo local.
- Dos Cloud Functions (la de IA queda desactivada por defecto): saveInventoryProduct (alta/edición) y analyzeInventoryProduct (borrador QwenCloud).
- Costos/precios en centavos enteros, códigos de servidor escalables, idempotencia por operación y control de revisión al editar.
- QwenCloud devuelve un borrador validado. No crea productos. No se aceptan costos/precios estimados por el modelo: esos importes sólo se extraen de notas explícitas como «costo Q98, precio Q245»; si son ambiguos quedan vacíos.
- Errores de análisis y guardado conservan foto/notas/formulario. Registro manual disponible si la IA falla. La confirmación de guardado sólo ocurre tras respuesta del servidor con código persistido.

## Monorepo
| Ruta | Responsabilidad actual |
|---|---|
| apps/web/src/cloud | Inicialización SDK, acceso, membresía, suscripción inventario, llamadas y fotos |
| apps/web/src/prototype | UI compartida con modo demo separado |
| apps/functions/src/index.ts | Autorización, transacciones, operaciones y cuotas |
| apps/functions/src/qwen.ts | Gateway regional QwenCloud, timeout y validación de salida |
| packages/shared/src/index.ts | Contratos, validaciones, importes, códigos y rutas de fotos |
| firebase.json / firestore.rules / storage.rules | Hosting, Functions, reglas y emuladores |

El build de Functions incluye una copia compilada de los contratos compartidos dentro de apps/functions/lib; el despliegue no necesita resolver archivos TypeScript fuera de su directorio fuente.

## Configuración que falta
Proyecto confirmado: project-97ed847a-4800-435a-b4a. Cuenta indicada: skepcodegt@gmail.com, configuración gcloud nineshop. La asociación local está en .firebaserc y el projectId en apps/web/.env.local (ignorado por Git).

El usuario aceptó los términos de Firebase y confirmó Blaze en la consola. Después se registró la app «Hackaton Web MVP» (appId 1:101578284715:web:2ec9854ffb0dd1329ca1ee). Su configuración pública está en apps/web/.env.local, ignorado por Git; el .env original de Gogo se conserva.

Firestore está vacío y listo en us-central1. El bucket real es project-97ed847a-4800-435a-b4a.firebasestorage.app, también en us-central1, vacío. La configuración backend apunta a ese bucket. No se han publicado las reglas del monorepo, Functions ni Hosting.

La consola indica que reCAPTCHA Classic está obsoleto y su registro está deshabilitado. El cliente usa ReCaptchaEnterpriseProvider. Registrar una clave web basada en puntuación para los dominios de Hosting (project-97ed847a-4800-435a-b4a.web.app y project-97ed847a-4800-435a-b4a.firebaseapp.com), sin desafío de casilla. No agregar localhost a esa clave de producción. Registrar la misma clave pública en App Check y VITE_FIREBASE_APP_CHECK_SITE_KEY. La clave web «Hackaton Web MVP» fue creada con los dos dominios, verificación de dominio activa y sin desafío; la app está Registrada con Fraud Defense en App Check. La misma clave pública quedó guardada en VITE_FIREBASE_APP_CHECK_SITE_KEY. No se activó enforcement adicional en otros servicios desde la consola.

La creación del operador con contraseña requiere intervención del usuario en la consola; el correo de prueba test@test.com quedó preparado, sin introducir ni guardar contraseña. La clave de sitio pública de reCAPTCHA no es una contraseña. No compartir contraseñas o claves secretas en el chat. Para pruebas locales de servicios, usar los emuladores descritos abajo.

QwenCloud queda para la siguiente fase: VITE_ENABLE_QWENCLOUD=false y ENABLE_QWENCLOUD=false. La función no declara ni solicita el secreto mientras esté apagada. El frontend muestra Próximamente y permite el registro manual, y la demo conserva su simulación.

1. Completado: Firebase habilitado en el proyecto confirmado y aplicación web registrada.
2. Completado: configuración pública web y bucket backend guardados en archivos locales ignorados.
3. Proveedor correo/contraseña habilitado. Pendiente: el usuario crea un operador en Authentication → Usuarios → Agregar usuario, introduciendo su contraseña directamente en la consola.
4. Completado: Firestore Standard y Storage privados en us-central1. Región frontend/backend coincidente; no desplegados.
5. Para el UID del operador, crear desde consola/admin el documento stores/principal/members/UID con active=true y role="admin" (o editor/viewer). Esta membresía sigue pendiente. No permitir al cliente darse permisos.
6. Completado: app registrada con App Check Enterprise y VITE_FIREBASE_APP_CHECK_SITE_KEY configurada. Functions exige App Check en producción; sólo el emulador lo omite.
7. Pendiente: desplegar reglas, funciones y Hosting; aplicar CORS al bucket y probar el flujo real. La configuración backend local ya incluye el bucket real. No agregar archivos .env locales a Git.
8. **Siguiente fase (pospuesto por el usuario):** crear clave de QwenCloud pay-as-you-go en la región escogida. La región de la clave y QWENCLOUD_REGION deben coincidir. Valor propuesto: ap-southeast-1 y modelo qwen3-vl-plus; verificar disponibilidad de la cuenta.
9. **Siguiente fase:** guardar la clave exclusivamente en Secret Manager, cuando el proyecto esté confirmado:

```bash
firebase functions:secrets:set QWENCLOUD_API_KEY --project PROJECT_ID
```

La clave no debe pegarse en el chat, en el frontend ni en una variable VITE_. No se ejecutó este comando y no es requisito para cerrar la fase de inventario manual. Al activar IA en la fase siguiente, habilitar explícitamente ambos flags y volver a desplegar Functions y web.

## Fotografías y CORS
El cliente comprime fotos a JPEG y el servidor/reglas limitan cada archivo a 1 MB. Un archivo original admite hasta 8 MB antes de comprimir. Las fotos se leen con autorización y URLs blob temporales, sin generar enlaces de descarga públicos permanentes. Las rutas son inmutables; reemplazar una foto crea otra ruta.

Para que getBlob funcione en navegador, configurar CORS del bucket para GET desde los orígenes de la app. cors.example.json es una plantilla con localhost y dominios de Hosting; reemplazar los placeholders antes de aplicarla al bucket real. No se aplicó ninguna política CORS.

Una foto que no se pudo descargar no pierde su referencia al editar otros campos. Las imágenes se cachean durante la sesión para evitar descargarlas de nuevo en cada actualización de inventario.

Las fotos subidas antes de un guardado que luego falla pueden quedar sin producto asociado; no se eliminan automáticamente ante una respuesta incierta. La limpieza/retención de estos archivos queda pendiente antes de producción. No hay cuota de cantidad de fotos por tienda en esta fase.

## Reglas y operaciones
- Miembro activo: consulta de productos de su tienda.
- Admin/editor: altas, edición y análisis a través de Functions; viewer sólo consulta.
- El cliente no escribe productos, códigos, contadores, membresías, operaciones ni cuotas directamente en Firestore.
- La autorización se vuelve a comprobar dentro de las transacciones.
- El producto tiene un ID estable desde que se abre el formulario. Un reintento no crea otro producto aunque se pierda la primera respuesta.
- Reutilizar un identificador de operación con otro contenido se rechaza. Editar una revisión obsoleta también se rechaza.
- App Check está activo fuera del emulador.
- Fotos: sólo creación por su propietario autorizado, JPEG y tamaño acotado; sin sobrescritura ni borrado desde el cliente.
- IA: máximo 20 intentos por usuario y 40 por tienda por día UTC; maxInstances=2, timeout proveedor 30 segundos. Solicitudes iguales completadas reutilizan su resultado. Un intento fallido puede consumir cuota. Son límites operativos, no garantía de costo cero.

## Probar localmente con emuladores
El entorno del agente sigue sin poder abrir puertos. Estos pasos se ejecutan en la Terminal del equipo cuando corresponda:

Ejecutar primero npm ci si faltan dependencias. Preparar las variables siguientes antes de iniciar los emuladores.

El proyecto de emulación está fijado a demo-hackaton. Crear apps/functions/.env.local con PRODUCT_STORAGE_BUCKET=demo-hackaton.appspot.com y los parámetros de ejemplo. Para evitar buscar secretos reales al iniciar el emulador, crear apps/functions/.secret.local con QWENCLOUD_API_KEY=FAKE-EMULATOR-KEY. Esa clave ficticia no sirve para analizar con QwenCloud; los tests del gateway usan respuestas simuladas, sin red.

En apps/web/.env.local, usar configuración pública de emulador:

```dotenv
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-hackaton.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-hackaton
VITE_FIREBASE_STORAGE_BUCKET=demo-hackaton.appspot.com
VITE_FIREBASE_APP_ID=demo-web-app
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
VITE_FIREBASE_STORE_ID=principal
VITE_FIREBASE_STORE_NAME=Tienda de prueba
VITE_USE_FIREBASE_EMULATORS=true
```

Con esos archivos preparados, ejecutar npm run emulators en una Terminal. En otra:

```bash
npm run seed:emulators
npm run dev
```

El seed sólo admite Auth/Firestore en 127.0.0.1 y proyecto demo-hackaton. Crea usuarios ficticios admin@example.test, editor@example.test, viewer@example.test y sin-acceso@example.test; contraseña de prueba Demo-Only-321!. El último no tiene membresía. Ninguno corresponde a una cuenta real.

El frontend sólo admite emulación desde localhost/127.0.0.1 con projectId demo-hackaton. Para la demo de fase 2 sin emuladores, abrir http://localhost:3017/?mode=demo.

## Pruebas realizadas y pendientes
Realizadas: 48 pruebas unitarias aprobadas (17 de la demo, 9 de contratos, 9 de gateway Qwen con mocks y 10 del handler de inventario con repositorio en memoria y 3 del bloqueo de Qwen deshabilitado). Build TypeScript de backend y web completado. Las pruebas del handler no validan App Check HTTP, reglas ni concurrencia de Firestore real.

Pendientes (no afirmar como comprobadas): navegación visual; login real; reglas Firestore/Storage ejecutadas; aislamiento entre tiendas y concurrencia en emulador; foto con CORS real; llamada real a QwenCloud; Hosting y Functions desplegados.

Commit propuesto: feat: integrate Firebase inventory and QwenCloud gateway. No se creó el commit porque el entorno sigue impidiendo escribir .git.

Para cerrar esta fase, falta crear el operador y su membresía, desplegar reglas/funciones/web y probar inventario y fotos contra Firebase real. La clave de QwenCloud queda expresamente pospuesta. No avanzar a Live real o pagos reales hasta revisar esta integración.

## Fuentes oficiales
- https://firebase.google.com/docs/functions/callable
- https://firebase.google.com/docs/functions/config-env
- https://firebase.google.com/docs/app-check/cloud-functions
- https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/storage/security/core-syntax
- https://docs.qwencloud.com/developer-guides/getting-started/regions
- https://docs.qwencloud.com/api-reference/chat/openai-chat
- https://docs.qwencloud.com/developer-guides/text-generation/structured-output

## Última comprobación de acceso
Consola autenticada como skepcodegt@gmail.com: Firebase habilitado, app web registrada, proveedor email/password habilitado, Firestore listo y bucket vacío comprobados visualmente. Las consultas CLI anteriores no representan el estado actual. El CLI del agente sigue limitado al renovar credenciales fuera del workspace; no se copiaron tokens ni bases de credenciales para eludir esa restricción.
