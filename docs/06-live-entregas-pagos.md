# Fase 4 · Live, entregas y pagos conectados

Estado: implementación local. El usuario pidió continuar el desarrollo y probar Firebase después. QwenCloud sigue desactivado. No se ha desplegado ni validado este flujo contra servicios reales.

## Flujo implementado

1. Crear un cliente con nombre, contacto y dirección opcional. El contacto normalizado es único dentro de la tienda.
2. Iniciar el live, presentar una pieza disponible y agregar interesados por orden de llegada.
3. Confirmar al primer comprador y su precio final. El servidor verifica comprador y revisión antes de vender; una reserva cambiada obliga a revisar la confirmación.
4. Agrupar las piezas en el pedido pendiente del cliente. Un pedido despachado deja de aceptar nuevas piezas. La venta no registra ningún cobro.
5. En Entregas, registrar un pago completo o varios abonos. Cada pago guarda importe, método, referencia y fecha del servidor; el saldo incluye el envío. No se admiten sobrepagos ni transferencias sin referencia.
6. Planificar dirección, transportista, fecha, guía, tarifa de envío y costo del mensajero. El nuevo total no puede quedar por debajo de lo ya abonado.
7. Despachar con saldo cero o con modalidad contraentrega. Confirmar la entrega contraentrega registra exactamente el saldo cobrado; conciliar el depósito del mensajero es una acción separada que no crea otro pago.
8. Devolver un paquete en ruta cancela el saldo cobrable, conserva el historial y marca sus piezas En revisión. Si había abonos, la interfaz indica reembolso pendiente. Reintegrar una pieza inspeccionada la deja disponible sin modificar el pedido histórico.

Los pagos y depósitos son registros manuales. No hay pasarela bancaria, movimiento automático de dinero, transmisión de video ni importación de comentarios de redes sociales. El live es un panel para operar mientras se transmite en una red social.

## Consistencia, permisos y reintentos

La función executeCommerce exige sesión y App Check en producción. Cada transacción vuelve a comprobar la membresía activa y el rol admin/editor de la tienda. Viewer sólo consulta. Reglas Firestore deniegan todas las escrituras directas de clientes sobre productos, pedidos, clientes, live, índices, contadores y operaciones.

El servidor calcula saldos y códigos; los clientes no pueden enviar estados finales ni totales arbitrarios. Precios/importes usan centavos enteros. Pedido y producto llevan revisión. El cierre de live también exige el identificador de sesión capturado al abrir el diálogo, para impedir que un operador cierre accidentalmente una sesión nueva desde un diálogo viejo. Un índice privado openOrders por cliente permite agrupar ventas de forma transaccional; otro índice customerContacts evita duplicados de contacto normalizado incluso si dos operadores crean el mismo contacto.

Cada comando usa un UUID de operación y una huella de su contenido. Repetir una solicitud completada devuelve el resultado anterior; reutilizar su ID con otro contenido u operador se rechaza. Esto cubre ventas y pagos tras respuestas perdidas. Los comprobantes de operación se conservan para reconocer reintentos; no hay política automática de eliminación en este MVP.

Los formularios conservan el comando exacto ante resultados inciertos y bloquean nuevos envíos mientras se verifica. Una bandeja global permite verificar operaciones pendientes aunque su pago ya haya dejado saldo cero o el producto aparezca vendido. Los conflictos definitivos de revisión permiten cerrar y abrir de nuevo el formulario. La confirmación de éxito requiere respuesta del servidor.

## Datos y límites del MVP

| Ruta dentro de stores/{storeId} | Uso |
|---|---|
| products/{id} | Pieza única y su estado/revisión |
| customers/{id} | Cliente y contacto |
| customerContacts/{hash} | Índice privado de contacto normalizado |
| orders/{id} | Pedido, líneas con snapshot, pagos, envío y revisión |
| openOrders/{customerId} | Referencia privada al último pedido abierto del cliente |
| live/current | Sesión actual, piezas presentadas y vendidas |
| counters/orders | Secuencia PED del servidor |
| operations/{uuid} | Resultado y huella de la operación |

Los snapshots de línea conservan nombre, código, talla y ruta de foto; el cliente también se guarda como snapshot del pedido. El detalle conserva referencias legibles aunque los documentos de producto/cliente ya no estén entre los últimos 200 cargados. No se implementó paginación ni búsqueda en todo el historial: las pantallas cargan los últimos 200 documentos por colección. Las métricas se basan en esos documentos visibles; no equivalen a reportes contables completos.

Máximo por sesión: 200 piezas presentadas y 200 ventas; por cola: 100 interesados; por pedido: 100 piezas y 200 pagos. Son límites explícitos para la demo, no cuotas globales de tienda. El backend lee sólo los documentos afectados y sus índices dentro de cada transacción.

## Despliegue y comprobación pendiente

El script scripts/deploy-phase3.sh ahora incluye executeCommerce junto con las dos funciones de inventario, reglas, CORS y Hosting. Ejecutarlo desde la Terminal del equipo cuando se retomen los servicios reales; no se ha ejecutado con éxito desde el entorno del agente por su restricción sobre ~/.config. El primer commit existente es 04d22bd; esta fase es posterior.

Antes de la prueba real falta crear el usuario operador y su membresía en stores/principal/members/UID. Introducir la contraseña directamente en Firebase Console. No copiarla al código ni a Firestore.

Validación final: 76/76 pruebas unitarias aprobadas, build TypeScript de Functions y build TypeScript/Vite de la web correctos, comprobación local de configuración correcta y script de despliegue con sintaxis Bash válida. Las revisiones UI/UX fueron estáticas. La validación local cubre lógica pura y handlers con repositorio en memoria. No demuestra concurrencia real, verificación HTTP de App Check, reglas ejecutadas, CORS real ni comportamiento visual en navegador. Esas pruebas quedan pendientes por decisión del usuario.

Prueba manual al retomar Firebase: crear cliente → presentar dos piezas → reservar → confirmar ambas al mismo cliente → revisar pedido agrupado → abono → planificar → completar saldo/despachar o cobrar remanente contraentrega → confirmar entrega → conciliar depósito. Probar además rechazo de sobrepago, operación repetida, conflicto entre operadores, rol viewer y devolución con reintegro.
