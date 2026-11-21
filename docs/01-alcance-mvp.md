# Fase 1 · Alcance y acuerdos del MVP

Estado: propuesta lista para revisión del usuario. Fecha: 2026-11-21.

## Objetivo
Demostrar el recorrido de una pieza desde su registro manual o asistido por IA hasta su venta en un live, la creación de un pedido y su entrega con pagos completos o parciales. Construir por fases; revisar, probar y hacer un commit al cerrar cada una. No avanzar a la siguiente fase sin revisión del usuario.

## Decisiones confirmadas
- Base visual: Gogo Vite MUI Admin Starter v9.2.0 provisto por el usuario.
- Plataforma: GCP con Firebase. La aplicación se desplegará cuando corresponda a la fase de demo.
- IA: QwenCloud. Confirmar endpoint, región, modelo y credenciales de QwenCloud en la fase de conexión, sin asumir que utiliza el endpoint de Alibaba Cloud.
- Entregas debe registrar pagos completos y parciales por pedido.
- Nombre, logo y colores definitivos pendientes. Usar identidad provisional reemplazable.
- Tres subagentes: revisión de UI, revisión de UX y QA. El agente principal implementa e integra.

## Alcance propuesto por módulo

| Módulo | Incluido en el MVP | Criterio de cierre |
|---|---|---|
| Inventario manual | Alta y edición de pieza individual, código único, tipo, procedencia, nombre/descripción, marca, talla, costo, precio, fotografías; búsqueda y filtro por estado | Una pieza válida se guarda y aparece disponible; datos inválidos no se guardan |
| Inventario con IA | Subir foto y/o descripción, generar propuesta de campos con Qwen, revisar y corregir, confirmar alta | Ninguna sugerencia entra en inventario sin confirmación; campos desconocidos quedan pendientes |
| Clientes de apoyo | Nombre, contacto estable y dirección; seleccionar o crear al reservar | El mismo contacto no genera clientes duplicados |
| Ventas live | Crear/iniciar/finalizar sesión operativa; presentar producto, ordenar interesados, reservar, cancelar y confirmar comprador; ajustar precio final; resumen de ventas | No hay doble venta; cancelar promueve al siguiente interesado; confirmar crea o amplía pedido |
| Pedidos | Agrupar piezas del mismo cliente mientras su pedido esté pendiente; nuevo pedido después del despacho | La compra se refleja inmediatamente en Entregas y no modifica paquetes ya enviados |
| Entregas | Lista por estado, detalle de paquete, dirección, fecha, mensajero/transportista y guía manual o interna; despacho, entrega y devolución de paquete | Cambiar estado afecta al paquete completo y queda registrado |
| Pagos en Entregas | Pago completo, abonos parciales, saldo e historial; efectivo, transferencia o contraentrega; referencia según método | Varios abonos suman correctamente, no superan saldo y los reintentos no duplican cobros |
| Devolución básica | Paquete enviado que no fue entregado; motivo y recepción/inspección antes de liberar stock | El producto no vuelve a disponible hasta su inspección |

Live significa panel operativo de ventas durante la transmisión. La transmisión de video y la lectura automática de comentarios de Facebook, Instagram, TikTok o WhatsApp no están incluidas en esta propuesta.

## Flujo demostrable
1. Registrar una prenda manualmente.
2. Registrar otra a partir de una sugerencia de Qwen revisada por el operador.
3. Iniciar un live y presentar ambas prendas.
4. Añadir interesados; cancelar el primero y confirmar al siguiente.
5. Confirmar otra pieza del mismo cliente: ambas quedan bajo el mismo pedido pendiente.
6. Abrir el pedido en Entregas y registrar un abono: mostrar pago parcial y saldo.
7. Registrar el resto: mostrar pagado y saldo cero.
8. Completar datos del envío, despachar y entregar.
9. Demostrar una compra posterior al despacho bajo un pedido nuevo.

## Estados y reglas propuestas
- Producto: Disponible → En Live → Reservado → Vendido. Una devolución recibida pasa a En revisión antes de reintegrarse.
- Pedido: Pendiente → Enviado → Entregado o Devuelto.
- Pago: Pendiente de pago / Pagado parcialmente / Pagado. Estado independiente del estado logístico.
- Finalizar el live devuelve las piezas En Live a Disponible; conserva las reservas pendientes para resolverlas manualmente.
- Confirmar una venta crea o amplía el pedido, pero no registra un cobro. Los pagos reales se registran en Entregas.
- Añadir una pieza a un pedido pendiente con abonos conserva el historial y recalcula el saldo. Un pedido pagado puede volver a Pagado parcialmente.
- Un producto es una pieza única en este MVP; cantidades y variantes complejas se posponen.
- Los importes se almacenarán en centavos enteros, con dos decimales al mostrarlos. No usar sumas monetarias de punto flotante.
- Propuesta de pagos mixtos: el método se guarda por abono, permitiendo efectivo y transferencia en un mismo pedido. Contraentrega identifica la modalidad de cobro del saldo, no un método único que bloquee otros abonos.
- Propuesta de cambios de total: agregar productos o fijar el envío antes del despacho recalcula el saldo y requiere mostrar el nuevo total al operador. Una modificación que deje pagos superiores al total se bloquea hasta definir un ajuste/reembolso; no genera crédito silencioso. Precios y envío quedan congelados al despachar.
- Cada pago tendrá identificador, monto, método, fecha, operador y referencia cuando corresponda. Los saldos se calculan desde los pagos registrados.
- Confirmar ventas, generar códigos y registrar pagos requiere transacciones en servidor. Un reintento usa el mismo identificador de operación para evitar duplicados.
- No borrar pagos confirmados. Una corrección deberá quedar registrada mediante reverso y motivo; su interfaz se definirá antes de implementar pagos.
- El registro de pagos es manual por un operador. No implica pasarela bancaria ni cargo automático a tarjetas.
- Regla pendiente de validación: bloquear despacho/entrega con deuda salvo contraentrega. Se propone seguir esta regla de la matriz hasta que el usuario decida otra cosa.
- Contraentrega: permitir despacho con saldo; al entregar, registrar el cobro. Distinguir cobro del mensajero y depósito conciliado; no marcar depósito automáticamente al entregar.
- Propuesta para devoluciones con pagos previos: conservar el historial, cancelar el saldo cobrable y mostrar reembolso pendiente por lo efectivamente pagado. No aceptar nuevos cobros en el pedido devuelto. La política de devolución del costo de envío queda pendiente de acuerdo. Automatizar reembolsos queda fuera del MVP.

## Organización del repositorio
Monorepo npm workspaces confirmado por el usuario: apps/web para el frontend Gogo, apps/functions para Firebase Functions y packages/shared para contratos y validaciones compartidos.

## Propuesta técnica
| Componente | Servicio propuesto | Responsabilidad |
|---|---|---|
| Web | Firebase Hosting + React/Vite/MUI de Gogo | Panel administrativo adaptable |
| Acceso | Firebase Authentication, correo/contraseña | Identidad de operadores |
| Datos | Cloud Firestore | Productos, clientes, lives, pedidos, pagos y eventos |
| Fotos | Cloud Storage for Firebase | Fotografías con límites de tamaño/tipo |
| Operaciones críticas | Cloud Functions for Firebase | Venta, pagos y cambios logísticos transaccionales |
| IA | Cloud Function → QwenCloud | Credencial privada, validación de respuesta y borradores |
| Secretos | Secret Manager | Clave de Qwen fuera del navegador/repositorio |
| Pruebas locales | Firebase Emulator Suite + pruebas de dominio/UI | Probar antes de desplegar |

La cuenta/proyecto Firebase y el endpoint/modelo de Qwen quedan pendientes para la fase técnica. Una tienda y equipo pequeño en este MVP; SaaS multiempresa, suscripciones y administración multiubicación no forman parte del alcance propuesto. El acceso a datos debe estar limitado a usuarios autorizados de la tienda; no abrir la base públicamente.

## Costos y límites
Cloud Functions y Cloud Storage requieren plan Blaze/facturación vinculada. Firebase no implica costo cero. Definir alertas de presupuesto, límites de instancias y solicitudes IA, compresión de fotos, consultas paginadas y datos de prueba acotados. Las alertas de presupuesto no son por sí solas un corte del gasto. El consumo de Qwen se factura según la cuenta/modelo elegido; no hay estimación aprobada todavía.

## Fuera del alcance propuesto
Contabilidad, impuestos y comisiones complejas; pasarelas de pago; reembolsos automáticos; compras/proveedores y traslados; importación masiva Excel; integración de transportistas; captura automática de comentarios y transmisión de video; SaaS multiempresa. Se revisará cualquier ampliación antes de agregarla.

## Criterios de diseño para fase 2
- Pantallas navegables: listado y alta manual de inventario, carga/borrador IA, sesión live y cola, confirmación de venta, listado y detalle de pedidos, registro de pago, planificación de envío y devolución.
- Entregas muestra total, abonado, saldo y estado de pago en lista y detalle, separados del estado logístico.
- Prototipar pedidos sin pago, con pago parcial, pagados, COD cobrado pendiente de depósito y reembolso pendiente.
- El formulario de pago muestra saldo actual, monto, método, referencia aplicable y saldo resultante antes de confirmar; después muestra comprobante interno e historial. Distinguir error y reintento.
- Conservar tipografías, componentes y recursos visuales de Gogo, con nombre/logo/acento reemplazables.
- Revisar a 390px y 1440px sin desbordes, con etiquetas accesibles, foco visible y estados indicados con texto además de color. Incluir estados vacío, cargando y error.

## Fases y commits previstos
| Fase | Entregable | Validación y commit |
|---|---|---|
| 1 · Alcance | Este documento y reglas pendientes identificadas | UI/UX/QA revisan propuesta; commit docs: define MVP scope and delivery payments |
| 2 · Diseño | Pantallas navegables con datos de ejemplo y plantilla | Revisar escritorio/móvil y flujo; commit feat: add MVP navigation and screen prototype |
| 3 · Inventario | Firebase base + alta manual + borrador Qwen | Validación, persistencia y reglas de acceso; commit feat: add inventory and Qwen-assisted intake |
| 4 · Live | Reservas, cola y venta transaccional a pedidos | Prioridad, agrupación y concurrencia; commit feat: connect live sales to orders |
| 5 · Entregas y pagos | Planificación, abonos, saldos y entrega | Pagos repetidos/concurrentes, deuda, COD y devolución; commit feat: add delivery workflow and partial payments |
| 6 · QA y demo | Flujo integrado, despliegue Firebase y guion | Pruebas de regresión y smoke test del despliegue; commit chore: prepare hackathon demo |

## Validación de la fase 1
Revisión documental realizada por los tres subagentes UI, UX y QA. Sus observaciones sobre cierre de live, separación venta/cobro, estados de pagos, pagos mixtos y devolución con abonos quedaron incorporadas como propuestas. No se ejecutaron nuevas pruebas funcionales en esta fase documental.

Casos de aceptación para implementar después:
- Dos operadores confirman la misma pieza: solo una venta queda registrada.
- Dos abonos de Q100 sobre un total Q250 dejan saldo Q50; completar Q50 deja saldo cero. Reintentar un mismo pago no vuelve a descontarlo.
- Pago de Q0.001, monto negativo, monto no numérico o superior al saldo: rechazado sin mutación.
- Agregar una pieza a un pedido pendiente pagado recalcula saldo y conserva los abonos previos.
- Pedido devuelto no admite cobros ni vuelve a disponible sin inspección.
- Un usuario sin autorización no lee ni modifica datos; la credencial Qwen no aparece en el cliente.
- Qwen sin respuesta o con campos incompletos permite corregir el borrador y no crea productos automáticamente.

## Estado real al finalizar esta fase
- Plantilla copiada al directorio del proyecto.
- Los cambios experimentales de dependencias se revirtieron al manifiesto y configuración originales de Gogo.
- Existe un prototipo previo no integrado en src/mvp/domain.ts y tests/domain.test.ts. No representa la arquitectura Firebase acordada ni está listo para producción. Debe revisarse/reemplazarse en la fase de implementación.
- No hay UI del MVP ni Firebase/Qwen conectados; no se ha desplegado nada.
- La instalación original de dependencias no pudo completarse: la red del entorno no resuelve registry.npmjs.org y la caché no contiene todas las versiones. No se ha validado build del starter.
- Git no está inicializado: el entorno rechaza escribir .git. El primer commit queda pendiente hasta habilitar Git desde el equipo del usuario.

## Fuentes técnicas consultadas
- Firebase precios: https://firebase.google.com/pricing
- Cloud Functions y facturación: https://firebase.google.com/docs/functions/faq-and-troubleshooting
- Cloud Storage y Blaze: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Transacciones Firestore: https://firebase.google.com/docs/firestore/manage-data/transactions
- API Qwen compatible: https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope
- Qwen con imágenes: https://www.alibabacloud.com/help/en/model-studio/qwen-vl-compatible-with-openai
