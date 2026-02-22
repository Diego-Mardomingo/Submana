# Estructura del proyecto Submana

## Proyecto principal (raíz)

El proyecto Next.js es el proyecto principal y está en la **raíz del repositorio**.

```
Submana/
├── src/                    # Código Next.js (app, components, hooks, lib)
├── public/                 # Assets estáticos (favicon, iconos)
├── astro/                  # Proyecto Astro original (referencia)
├── package.json            # Dependencias Next.js
├── next.config.ts
├── tsconfig.json
└── middleware.ts
```

## Comandos

- **Desarrollo**: `pnpm dev` (desde la raíz)
- **Build**: `pnpm build` (usa webpack; Serwist PWA no soporta Turbopack aún)
- **Supabase** (schema, migraciones): usar MCP de Supabase

## Nota sobre iconos PWA

El manifest (`src/app/manifest.ts`) referencia iconos PNG que deben generarse:
- `public/icons/web-app-manifest-192x192.png`
- `public/icons/web-app-manifest-512x512.png`

Puedes generarlos desde `public/icons/favicon.svg` con una herramienta como [realfavicongenerator.net](https://realfavicongenerator.net) o [pwa-asset-generator](https://github.com/onderceylan/pwa-asset-generator).
