# Submana

[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![PWA](https://img.shields.io/badge/PWA-instalable-5A0FC8?logo=pwa&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Submana** es una aplicación PWA de finanzas personales que te permite registrar ingresos y gastos, gestionar tus cuentas bancarias, controlar tus suscripciones, definir presupuestos por categoría y analizar tus hábitos financieros a través de un completo dashboard con más de 16 gráficos interactivos.

<div align="center">
  <img width="128" src="public/favicon.svg" alt="Submana logo">
</div>
<div align="center" style="margin: 2rem 0;">
  <a href="https://submana.vercel.app">
    <img src="https://img.shields.io/badge/Visitar_Submana-8b5cf6?style=for-the-badge&logoColor=white" alt="Visitar Submana">
  </a>
</div>

---

## ✨ Lo que ofrece Submana

### 🗓️ Calendario interactivo
Vista mensual que muestra las transacciones de cada día y los vencimientos de tus suscripciones. Puedes filtrar por cuenta y navegar entre meses con swipe en móvil o con las flechas del teclado.

### 📊 Dashboard analítico
Más de 16 widgets de análisis financiero:
- Tendencia del balance total y por cuenta
- Comparación mensual de ingresos y gastos
- Gastos diarios del mes actual
- Distribución del balance por cuenta (donut)
- Top categorías de gasto y top transacciones
- Previsión de gasto a fin de mes
- Proyección de ahorro anual
- Scatter de gastos por día e importe
- Flujo de caja y gasto por día de la semana

### 💸 Transacciones
Registro de ingresos y gastos asociados a una cuenta y categoría. Navegación mensual con estadísticas de ingresos, gastos y balance del mes. Detección automática de transferencias entre cuentas propias.

### 🔄 Suscripciones
Gestión de servicios recurrentes (streaming, software, etc.) con frecuencia configurable. Muestra el coste mensual y anual agregado de todas las suscripciones activas, y marca sus fechas de cobro en el calendario.

### 🏦 Cuentas bancarias
Múltiples cuentas con nombre, color e icono personalizables. Reordenables mediante drag & drop. Importación automática de extractos bancarios reales:

| Banco / Broker | Formato |
|---|---|
| Trade Republic | PDF |
| Revolut | Excel o CSV |
| BBVA | Excel |
| Imagin | CSV |

La importación detecta duplicados automáticamente y permite resolverlos manualmente antes de confirmar.

### 🎯 Presupuestos
Presupuestos mensuales por categoría con barra de progreso visual y alertas cuando se supera el límite establecido. Reordenables mediante drag & drop.

### 🏷️ Categorías
Categorías y subcategorías personalizables con emojis para clasificar tus transacciones.

---

## 📱 Experiencia de usuario

- **PWA instalable** en móvil y escritorio, con soporte offline
- **Diseño responsive**: bottom navigation en móvil, sidebar en escritorio
- **Swipe** para revelar acciones de editar y eliminar en móvil
- **Drag & drop** para reordenar cuentas y presupuestos
- **Atajos de teclado** para toda la navegación (`f`, `d`, `q`, `a`, `c`, `s`, `e`, `z`, `x`)
- **Temas** claro, oscuro y sistema — persistidos entre sesiones
- **Multiidioma**: Español e Inglés con sistema i18n propio
- **Animaciones** con Framer Motion y View Transitions API

---

## 🛠 Stack tecnológico

<div align="center">
  <img src="https://img.shields.io/badge/Next.js_15-000000?logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white" alt="Vercel">
</div>

| Categoría | Tecnologías |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 · shadcn/ui · Radix UI |
| Backend / Auth | Supabase (PostgreSQL + OAuth) |
| Estado y datos | TanStack Query v5 |
| Gráficos | Chart.js · react-chartjs-2 |
| Formularios | React Hook Form · Zod |
| Animaciones | Framer Motion · View Transitions API |
| Drag & Drop | dnd-kit |
| Importación | pdfjs-dist (PDF) · xlsx (Excel/CSV) |
| PWA | Serwist |

---

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/              # Rutas protegidas (layout con navegación)
│   │   ├── page.tsx         # Home — Calendario interactivo
│   │   ├── dashboard/       # Dashboard con 16+ widgets
│   │   ├── transactions/    # Historial de transacciones
│   │   ├── subscriptions/   # Gestión de suscripciones
│   │   ├── accounts/        # Grid de cuentas bancarias
│   │   ├── account/[id]/    # Detalle de cuenta + importación de extracto
│   │   ├── budgets/         # Presupuestos por categoría
│   │   ├── categories/      # Categorías y subcategorías
│   │   └── settings/        # Tema, idioma y sesión
│   ├── api/                 # Endpoints de la API (CRUD, importación, reorden)
│   ├── login/               # Página de autenticación OAuth
│   └── ~offline/            # Página offline (PWA)
├── components/
│   ├── dashboard/           # Widgets del dashboard
│   ├── home/                # Cards del Home (balance, resumen, budgets, donut)
│   ├── ui/                  # Componentes shadcn/ui personalizados
│   └── sortable/            # Componentes de drag & drop
├── hooks/                   # 25+ custom hooks con TanStack Query
├── lib/
│   ├── parsers/             # Parsers de extractos bancarios
│   ├── supabase/            # Cliente Supabase (server + browser)
│   └── i18n/               # Sistema de traducciones ES/EN
└── contexts/                # LangContext, CalendarFilterContext
```

---

## 📬 Contacto

<div align="center">

[![GitHub Profile](https://img.shields.io/badge/Diego_Mardomingo-181717?logo=github&logoColor=white&style=for-the-badge)](https://github.com/Diego-Mardomingo)
[![View Project](https://img.shields.io/badge/Ver_Repositorio-181717?logo=github&logoColor=white&style=for-the-badge)](https://github.com/Diego-Mardomingo/Submana)

</div>

---

<sub>Tu feedback es bienvenido · Hecho con ❤️</sub>
