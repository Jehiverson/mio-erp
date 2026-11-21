# Mio · Inventario, live y entregas

Monorepo npm workspaces. Inventario, Live, pedidos, entregas y pagos implementados para Firebase; implementación local pendiente de despliegue y prueba real. El proyecto project-97ed847a-4800-435a-b4a tiene app web, Authentication, Firestore/Storage privados en us-central1 y App Check Enterprise configurados. Falta crear operador con membresía. QwenCloud sigue desactivado y su clave está pospuesta. La demo local se conserva separada.

## Estructura

| Ruta | Responsabilidad |
|---|---|
| apps/web | React/Vite/MUI, recursos e iconos Gogo y prototipo navegable |
| apps/functions | Cloud Functions de inventario y gateway QwenCloud |
| packages/shared | Contratos, validaciones y códigos compartidos |
| docs | Alcance, decisiones, avances y guía de prueba |

## Ejecutar

Node.js 24 y npm 11. Desde la raíz del monorepo:

```bash
npm ci
npm run dev
```

Si las dependencias ya están instaladas, basta con npm run dev. Abrir http://localhost:3017 para acceso/configuración Firebase. Para la demo local sin servicios, usar http://localhost:3017/?mode=demo. El puerto es estricto: no se elegirá silenciosamente otro si está ocupado.

```bash
npm test
npm run build
npm run preview
```

Las pruebas de dominio no dependen de Firebase ni de llamadas IA. El build se guarda en apps/web/dist. Los cambios del prototipo se guardan únicamente en localStorage; «Reiniciar demostración» restaura los datos de ejemplo tras confirmación.

## Qué revisar

- [Conexión Firebase y QwenCloud](docs/04-firebase-qwen-fase3.md).
- [Cierre, commit y despliegue de fase 3](docs/05-cierre-fase3.md).
- [Live, entregas y pagos conectados](docs/06-live-entregas-pagos.md).
- [Alcance y fases](docs/01-alcance-mvp.md).
- [Estado y decisiones de la fase 2](docs/02-prototipo-navegable.md).
- [Guía para probar las pantallas](docs/03-guia-prueba-fase2.md).

## Identidad y plantilla

La identidad Mio (azul #0c4376, crema #fffbe7 y naranja #ed6a4f) está centralizada en apps/web/src/prototype/brand.ts. El catálogo de ejemplo utiliza figuras artesanales para corresponder con las fotografías incluidas en Gogo; también se pueden registrar ropa y otros tipos de producto.

Los fuentes originales de la plantilla y sus manifests se conservan en apps/web. El prototipo activo está aislado en src/prototype y usa MUI 5.18 / Vite 5.4 disponibles en la caché local, pues las versiones 9.4 / 8.3 del starter no estaban disponibles sin red. Se utiliza una fuente de sistema de respaldo mientras no estén instalados Mulish/Urbanist. No se ha completado una migración del starter entero a estas versiones.

## Límites actuales

El modo demo es local, sin autenticación real ni concurrencia entre usuarios. El modo Firebase usa funciones con transacciones para inventario y comercio; faltan operador con membresía, despliegue y validación real. Las pruebas locales no validan reglas ni concurrencia Firebase. Los pagos son registros manuales: no hay cargos bancarios automáticos. Las pantallas cargan los últimos 200 documentos por colección. En demo la IA es simulada. En nube QwenCloud está apagado (ENABLE_QWENCLOUD=false y VITE_ENABLE_QWENCLOUD=false). No existe integración de redes sociales ni mensajería.

No guardar secretos en variables VITE_ ni en el repositorio. La clave QwenCloud se configura exclusivamente mediante el secreto QWENCLOUD_API_KEY del backend.

## Dependencias offline

scripts/offline-bootstrap.cjs es una herramienta de recuperación usada en este entorno: requiere la caché npm previamente poblada y los módulos internos de npm. No sustituye npm ci en un equipo normal. No descarga paquetes ni ejecuta scripts de terceros.

## Commit de la fase

Primer commit verificado: `04d22bd` — `feat: add MVP monorepo and Firebase inventory integration`, rama `main`. El árbol de trabajo estaba limpio al reanudar la fase. Los pasos siguientes de despliegue están en docs/05-cierre-fase3.md.

No se ha configurado un repositorio remoto ni se ha hecho push. Los archivos .env, node_modules y dist están excluidos mediante .gitignore.
