# Fase 2 · Prototipo navegable

Fecha: 2026-11-21. Estado: implementación lista; revisión visual conjunta y commit pendientes.

## Entregado
- Monorepo npm workspaces: apps/web, apps/functions y packages/shared.
- Navegación entre Inventario, Ventas live y Entregas/pagos.
- Inventario con filtros, búsqueda, paginación, vistas de lista/tarjetas y detalle; alta manual/edición con foto.
- Flujo de carga IA simulado: selección de foto/notas, espera, borrador editable y confirmación. No se transmite información a QwenCloud.
- Live con inicio/cierre de sesión, presentación de piezas, clientes, cola, cancelación y confirmación del comprador.
- Ventas confirmadas crean o amplían pedidos pendientes del cliente y enlazan a su detalle en Entregas. No crean cobros automáticamente.
- Entregas con listado, estados separados de pago/logística, detalle, abonos, pagos completos e historial.
- Planificación de envío con total/saldo resultante, despacho, entrega COD, depósito conciliado por separado y devolución de paquete.
- Piezas devueltas quedan En revisión; una confirmación explícita de inspección permite reintegrarlas.
- Persistencia local de demostración y reinicio confirmado. Nombre/logo/acento provisional configurables en brand.ts.

## Revisión de subagentes
| Revisión | Resultado |
|---|---|
| UI | Revisión estática de componentes/CSS. Se incorporaron mejoras de contraste, texto, selección accesible de filtros y menú móvil MUI Drawer con foco gestionado. Tipografías originales pendientes; hay fallback de sistema. |
| UX | Se corrigieron callejón sin salida de inspección, resumen previo de costo de envío y aviso de depósito COD sin cobro real. |
| QA | 17 pruebas de dominio pasan. Incluyen reservas, doble venta, agrupación de pedidos, centavos exactos, pagos mixtos, idempotencia y regresión COD pagado por anticipado. |

## Verificación realizada
- npm test: 17/17 aprobadas.
- npm run build: TypeScript y Vite completados. Recursos divididos en chunks, sin advertencia de bundle superior a 500 kB.
- Lockfile de workspaces con integridad de paquetes; dry run offline de instalación realizado por QA.
- No se ejecutaron pruebas de navegador ni se capturaron pantallas: el entorno rechaza abrir el puerto local (listen EPERM), y el navegador bloquea la navegación file://. No se considera validado el diseño a 390/1440px hasta revisarlo en navegador.
- No hay commit: la carpeta no tenía repositorio Git y el entorno rechaza escribir .git. No hay push ni remoto configurado.

## Decisiones técnicas y límites
- Se conservaron código, assets y manifests originales Gogo, pero la entrada activa utiliza un subconjunto MUI/Vite compatible con las dependencias offline. Las versiones elegidas quedan fijadas en package-lock.json y los manifests de workspace.
- No hay llamadas Firebase, Functions o QwenCloud en la fase 2. Los otros dos workspaces son reservas de estructura.
- El proveedor QwenCloud debe configurarse con sus propios endpoint, región y modelo; no asumir que coincide con Alibaba Model Studio.
- La lógica del prototipo es únicamente ilustrativa. Las operaciones de producción deberán implementar autorización, transacciones e idempotencia en Firebase Functions.
- Los códigos del prototipo son consecutivos A0001…; la secuencia escalable completa se implementará y probará al conectar inventario.
- No existe pasarela de pago: los abonos se registran manualmente por el operador.
- La regla provisional mantiene bloqueo de despacho con deuda salvo COD; no se ha recibido una decisión distinta del usuario.

## Cierre pendiente
1. Abrir el prototipo en http://localhost:3017 y revisar el recorrido de docs/03-guia-prueba-fase2.md.
2. Validar escritorio y móvil, campos y claridad del flujo.
3. Crear commit local de esta fase cuando Git esté habilitado. Mensaje propuesto: feat: add monorepo and navigable MVP prototype.
4. Revisar con el usuario antes de iniciar la conexión Firebase/QwenCloud.
