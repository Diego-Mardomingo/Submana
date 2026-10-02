<div align="center">
  <img width="88" src="public/favicon.svg" alt="Submana">
  <h1>Submana</h1>
  <p>Finanzas personales sin hojas de cálculo.<br>Gastos, cuentas, suscripciones y presupuestos en una sola PWA.</p>
  <p><a href="https://submana.vercel.app"><strong>submana.vercel.app</strong></a></p>
</div>

<!--
  Capturas pendientes (con datos de demo): calendario, dashboard,
  importación de extractos y vista móvil.
-->

---

## Qué es

Submana nació para sustituir la hoja de cálculo con la que llevaba mis finanzas. Importa los extractos de mis bancos, detecta lo que ya estaba registrado y me deja ver de un vistazo en qué se va el dinero, qué suscripciones se cobran este mes y si voy a cumplir los presupuestos.

Es una aplicación real, en uso diario, instalable como PWA en móvil y escritorio.

## Funcionalidades

**Calendario.** Vista mensual con las transacciones de cada día y los próximos cobros de suscripciones, filtrable por cuenta.

**Dashboard.** Evolución del balance total y por cuenta, comparativa de ingresos y gastos entre meses, gasto diario, categorías y transacciones con más peso, previsión de gasto a fin de mes y proyección de ahorro anual.

**Importación de extractos.** Sube el extracto del banco y Submana crea las transacciones, ajusta el saldo y te pide confirmación ante posibles duplicados.

| Banco | Formato |
|---|---|
| Trade Republic | PDF |
| Revolut | Excel / CSV |
| BBVA | Excel |
| Imagin | CSV |

**Suscripciones.** Servicios recurrentes con frecuencia semanal, mensual o anual (cada N periodos), coste mensual y anual agregado y fechas de cobro en el calendario.

**Presupuestos y categorías.** Límites mensuales por categoría con progreso y avisos al superarlos. Categorías y subcategorías propias con emoji, archivables.

**Automatización.** Endpoint con token personal para registrar gastos desde fuera de la app, por ejemplo con un Atajo de iOS al pagar con el móvil.

**Detalles.** Modo privacidad que oculta los importes, tema claro/oscuro, español e inglés, atajos de teclado, gestos de swipe y reordenación con drag & drop.

## Arquitectura

```
Next.js (App Router)  ──►  Route Handlers /api  ──►  Supabase (Postgres + Auth)
        │                         │                        │
 TanStack Query            validación, rate limit     RLS + funciones RPC
 (caché + optimistic)      e importación               atómicas de saldo
```

Algunas decisiones que merece la pena contar:

- **La base de datos es la última línea de defensa.** Todas las tablas tienen Row Level Security con `WITH CHECK` en las escrituras: una fila solo puede referenciar cuentas y categorías del propio usuario, aunque alguien llame a PostgREST directamente con su sesión y se salte la API.
- **Saldos atómicos.** Crear, editar o borrar una transacción y ajustar el saldo de la cuenta ocurre en una única función de Postgres. Antes era leer-modificar-escribir desde la API, y una importación concurrente con una automatización podía perder actualizaciones o dejar saldos descuadrados.
- **Importación idempotente.** Cada parser normaliza el extracto a un formato común y cada fila genera una clave estable. Volver a subir el mismo extracto, aunque el banco lo exporte con otra zona horaria, no duplica movimientos; los casos dudosos se resuelven a mano y la decisión se recuerda.
- **Transferencias entre cuentas propias.** Un gasto y un ingreso del mismo importe en cuentas distintas y en una ventana de 48 h se emparejan (1:1, por cercanía temporal) y se excluyen de las métricas para no inflar ingresos ni gastos.
- **Una sola zona horaria de referencia.** Las transacciones se guardan como `timestamptz` y los límites de cada mes se calculan como rangos semiabiertos en `Europe/Madrid`, para que el día 1 a medianoche no caiga en el mes anterior.
- **UI optimista.** Las mutaciones actualizan la caché de TanStack Query al instante y hacen rollback si el servidor falla.
- **Rate limiting en Postgres.** Ventana fija sobre una tabla, sin servicios externos. La automatización y la importación están limitadas por usuario, y los intentos con token inválido por IP.
- **Tokens de automatización hasheados.** Solo se guarda el hash; el token en claro se muestra una vez.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase · TanStack Query · Chart.js · Framer Motion · dnd-kit · pdfjs · SheetJS · Serwist · Vitest · Vercel

## Desarrollo

Requiere Node 20+, pnpm y un proyecto de Supabase. Variables en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # automatización y rate limiting
```

```bash
pnpm install
pnpm dev          # servidor de desarrollo
pnpm test         # tests (parsers y lógica de dominio)
pnpm lint
pnpm typecheck
pnpm bones -- --cookie "sb-<ref>-auth-token.0=…" --cookie "sb-<ref>-auth-token.1=…"
                  # regenera los esqueletos de carga (boneyard) con `pnpm dev` en marcha
```

Los esqueletos de carga se capturan del layout real con [boneyard](https://github.com/0xGF/boneyard): cada estado de carga va envuelto en `<Bones name="…">` y `src/bones/` guarda las posiciones generadas. Tras cambiar el layout de una página, vuelve a ejecutar `pnpm bones`: recorre las rutas de la app y conserva los esqueletos que no encuentre (p. ej. una lista vacía este mes). Sin captura se muestra el esqueleto manual de `fallback`.

---

<div align="center">
  <sub>Hecho por <a href="https://github.com/Diego-Mardomingo">Diego Mardomingo</a></sub>
</div>
