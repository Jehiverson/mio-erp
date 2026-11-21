# Hackaton · Inventario, live y entregas

Monorepo npm workspaces. Fase 3: proyecto Firebase confirmado (project-97ed847a-4800-435a-b4a), acceso e inventario implementados; app web configurada, Authentication habilitado y Firestore/Storage privados creados en us-central1. App Check Enterprise registrado y configurado. Pendientes operador, despliegue y prueba real. QwenCloud está desactivado y su clave queda para la siguiente fase. La demo local de fase 2 se conserva separada.

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
- [Alcance y fases](docs/01-alcance-mvp.md).
- [Estado y decisiones de la fase 2](docs/02-prototipo-navegable.md).
- [Guía para probar las pantallas](docs/03-guia-prueba-fase2.md).

## Identidad y plantilla

La identidad provisional está centralizada en apps/web/src/prototype/brand.ts. El catálogo de ejemplo utiliza figuras artesanales para corresponder con las fotografías incluidas en Gogo; también se pueden registrar ropa y otros tipos de producto.

Los fuentes originales de la plantilla y sus manifests se conservan en apps/web. El prototipo activo está aislado en src/prototype y usa MUI 5.18 / Vite 5.4 disponibles en la caché local, pues las versiones 9.4 / 8.3 del starter no estaban disponibles sin red. Se utiliza una fuente de sistema de respaldo mientras no estén instalados Mulish/Urbanist. No se ha completado una migración del starter entero a estas versiones.

## Límites actuales

El modo demo es local, sin autenticación real ni concurrencia entre usuarios. El modo Firebase tiene integración SDK/Functions, con proyecto y app web configurados; App Check Enterprise registrado; faltan operador con membresía y despliegue validado. Las reservas/pagos simulados no son transacciones de producción. En demo la IA es simulada. En nube QwenCloud está apagado por defecto (ENABLE_QWENCLOUD=false y VITE_ENABLE_QWENCLOUD=false); sólo en la siguiente fase se activará por una función; ambos flujos requieren revisión y confirmación para crear inventario. No existe integración de redes sociales, cobro bancario o mensajería.

No guardar secretos en variables VITE_ ni en el repositorio. La clave QwenCloud se configura exclusivamente mediante el secreto QWENCLOUD_API_KEY del backend.

## Dependencias offline

scripts/offline-bootstrap.cjs es una herramienta de recuperación usada en este entorno: requiere la caché npm previamente poblada y los módulos internos de npm. No sustituye npm ci en un equipo normal. No descarga paquetes ni ejecuta scripts de terceros.

## Commit de la fase

El entorno del agente no permite escribir .git. Desde la Terminal del equipo, después de revisar la fase, el primer commit local puede crearse con:

```bash
git init -b main
git add .
git commit -m "feat: add MVP monorepo with Firebase inventory and QwenCloud"
```

No se ha configurado un repositorio remoto ni se ha hecho push. Los archivos .env, node_modules y dist están excluidos mediante .gitignore.
