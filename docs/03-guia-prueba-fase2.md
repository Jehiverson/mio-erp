# Guía de prueba · Fase 2

## Preparación
En una Terminal del equipo, desde /Users/jehi/Desktop/Hackaton, ejecutar npm run dev. Abrir http://localhost:3017. Si no hay dependencias instaladas, ejecutar primero npm ci (requiere acceso a npm).

Los datos son de ejemplo. El pago registrado en el prototipo no mueve dinero. El botón «Reiniciar demostración» restaura el estado inicial y pide confirmación.

## Inventario y carga manual
1. Buscar A0001; comprobar código, fotografía, descripción, precio y estado.
2. Buscar un texto inexistente y usar Limpiar filtros.
3. Cambiar entre lista y tarjetas; probar filtros combinados y paginación.
4. Abrir Nuevo producto. Intentar guardar con campos vacíos: debe impedirse.
5. Completar nombre, tipo, procedencia, costo y precio; opcionalmente subir JPG/PNG/WebP. Guardar y comprobar que aparece Disponible con nuevo código.
6. Editar un producto disponible. No debe cambiar su código.

## Carga asistida simulada
1. Abrir Cargar con IA y leer el aviso de simulación.
2. Pulsar Usar un producto de ejemplo y Ver borrador de ejemplo.
3. Cambiar nombre o precio. Cerrar sin guardar: no debe crear inventario.
4. Repetir y Confirmar y crear producto: debe aparecer en el catálogo.
5. Con foto/notas propias, el borrador no inventa información visual: exige completar los campos. La conexión real a QwenCloud se desarrollará después.

## Live, reservas y pedidos
1. Iniciar live y seleccionar A0001.
2. Presentar producto y agregar Andrea y Nicole a la cola.
3. Cancelar la reserva de Andrea: Nicole toma la primera prioridad.
4. Confirmar comprador y revisar precio antes de confirmar venta.
5. Abrir Ver pedido: debe corresponder a Nicole y conservar su saldo sin cobro automático.
6. Volver a Live y confirmar otra pieza para Nicole: se agrupa en su pedido pendiente.
7. Finalizar live: las piezas En Live sin reserva vuelven a Disponible; las reservas pendientes se conservan.

## Pagos parciales y completos
Reiniciar la demostración antes de esta prueba para usar montos exactos.

1. Abrir Entregas y PED-0001 de Andrea. Total Q400, abonado Q150 y saldo Q250.
2. Registrar abono Q100 en efectivo: antes de guardar debe mostrar saldo resultante Q150; después el historial suma Q250 abonados y saldo Q150.
3. Registrar un monto superior a Q150: debe rechazarse sin modificar el saldo.
4. Elegir transferencia sin referencia: no debe guardarse.
5. Usar Completar saldo (Q150), completar referencia si es transferencia y confirmar: Pagado, saldo Q0 e historial preservado.
6. Recargar la página: deben mantenerse los pagos locales.

## Planificación y entrega
1. Abrir el pedido, planificar dirección, mensajero y fecha. Dejar guía vacía para generar una interna.
2. Dejar cobro/costo de envío Q0 en esta prueba; revisar total y saldo antes de guardar.
3. Despachar pedido pagado y confirmar entrega.
4. Confirmar una compra nueva en Live para el mismo cliente: debe crear un pedido nuevo tras el despacho anterior.
5. En un pedido pendiente con deuda, despachar sin COD debe rechazarse. Activar contraentrega en Planificar envío permite despacharlo con saldo.

## Contraentrega y devolución
- PED-0003 ya está Enviado y tiene saldo Q200 (incluye Q25 de envío). Confirmar entrega exige registrar ese cobro completo; después muestra depósito del mensajero pendiente de conciliación.
- Conciliar depósito exige cuenta y referencia; no mueve dinero en el banco.
- Si se paga el saldo por adelantado en efectivo/transferencia antes de entregar, no debe aparecer un depósito ficticio del mensajero.
- Alternativamente, devolver un pedido Enviado: indicar motivo. El saldo cobrable se cancela, conserva pagos y muestra reembolso pendiente si había abonos.
- En Inventario, abrir una pieza En revisión y confirmar inspección para reintegrarla como Disponible.

## Revisión visual pendiente
Revisar a 1440px y 390px: navegación, tabla desplazable dentro del panel, formularios sin recortes, foco de teclado, menú móvil, errores recuperables y legibilidad de totales/abonos/saldos. Esta revisión aún no fue ejecutada por el agente debido a restricciones del entorno.
