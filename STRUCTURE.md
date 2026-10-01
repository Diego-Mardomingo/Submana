# Estructura del proyecto Submana

## Proyecto principal (raíz)

El proyecto Next.js está en la **raíz del repositorio**.

```
Submana/
├── src/
│   ├── app/                # App Router (páginas, API routes, sw.ts, manifest/route.ts)
│   ├── components/         # Componentes de UI
│   ├── contexts/           # Contextos de React (idioma, privacidad, filtros…)
│   ├── hooks/              # Hooks de datos (TanStack Query) y de UI
│   ├── lib/                # Lógica de dominio: parsers, importación, fechas, validación
│   └── proxy.ts            # Proxy de Next 16 (antes middleware.ts): sesión y rutas protegidas
├── supabase/migrations/    # Migraciones SQL (RLS, RPCs de saldo, índices, rate limit)
├── public/                 # Assets estáticos (iconos, fuentes)
├── package.json
├── next.config.ts          # Serwist (PWA) y cabeceras de seguridad (CSP…)
└── vitest.config.ts
```

## Comandos

Gestor de paquetes: **pnpm** (`packageManager` en package.json; no usar npm/yarn).

- **Desarrollo**: `pnpm dev`
- **Build**: `pnpm build` (usa webpack; Serwist PWA no soporta Turbopack aún)
- **Tests**: `pnpm test` (Vitest, funciones puras de `src/lib`)
- **Tipos / lint**: `pnpm typecheck` · `pnpm lint`

## Base de datos (Supabase)

- Todas las tablas de `public` tienen RLS: cada fila pertenece a `auth.uid()` y solo puede
  referenciar cuentas propias y categorías propias o del sistema.
- Los cambios de saldo van por RPCs atómicas (`create/update/delete_transaction_with_balance`,
  `delete_account_transactions`, `adjust_account_balance`); no actualizar `accounts.balance`
  con leer-modificar-escribir desde la API.
- Las migraciones viven en `supabase/migrations/`. Tras cambios de esquema, revisar los
  advisors de seguridad y rendimiento de Supabase.

## Zona horaria

La app trabaja en **Europe/Madrid** (todos los bancos soportados son españoles). Para agrupar
transacciones por día/mes en el cliente usar `toAppDate()` / `appNow()` de `src/lib/date.ts`,
no `new Date(tx.date)` con los getters locales del navegador.

## Iconos PWA

El manifest (`src/app/manifest/route.ts`) referencia iconos PNG en `public/icons/`
(`web-app-manifest-192x192.png`, `web-app-manifest-512x512.png` y variantes `-windows`).
