# Plan de toasts (issue #32)

Dónde dispara toasts la app y por qué. Las reglas de uso (tipos, textos, duraciones) están en `AGENTS.md` → Toasts; el diseño en `docs/design/toasts.html`.

## Estado de partida

- `sonner` eliminado; todo usa `toast` de `@/lib/toast`.
- Las mutaciones van por `api()` (`src/lib/api.ts`) a `/api/*` con React Query. `src/lib/queryClient.ts` no tenía manejo de errores global.
- Los DELETE son borrados duros en servidor.
- Feedback existente: errores inline en sheets (`FormError`), confirmaciones (`ConfirmSheet`, `ConfirmDeleteSheet`, `DeleteAction`) y toasts sueltos.
- i18n en `src/lib/i18n/ui.ts` (en/es, claves tipadas). Los textos nuevos van por `t(...)`.

## Decisiones

1. **Borrados reversibles con "Deshacer" y borrado diferido.** El DELETE no se envía hasta que el toast caduca. Mientras tanto la fila se oculta de la caché de React Query; si el usuario pulsa Deshacer, se restaura la caché y no se llama al servidor. Si la página se cierra (`pagehide`) se envían los borrados pendientes. Se implementa como hook reutilizable (`useUndoableDelete`).
2. **Crear y editar también confirman con toast** (`toast.success`), además de que la fila aparezca o cambie. La validación sigue inline en el formulario.
3. **La importación de extractos** muestra un `toast.success` con el número de movimientos importados, además de la pantalla de resultado.
4. **Errores**: ninguna mutación falla en silencio. Hay un `MutationCache.onError` global que muestra `toast.error` con un texto traducido (`apiErrorText`), salvo las mutaciones que lo gestionan ellas mismas (`meta: { silentError: true }`, p. ej. los formularios con error inline).
5. Se mantiene la confirmación previa (no Deshacer) en lo que no se puede revertir o arrastra otros datos: borrar cuenta, borrado masivo de transacciones, borrar categoría, borrar grupo, eliminar amigo, abandonar cuenta conjunta, cerrar sesión.

## Dónde va cada toast

### Transacciones
| Sitio | Acción | Toast |
|---|---|---|
| `TransactionSheet` | Crear / editar | `success` "Movimiento añadido / guardado" |
| `TransactionDayList`, `TransactionSheet` | Borrar | Deshacer (borrado diferido), sin confirmación previa |
| `AccountDetail` | Borrado masivo por rango | Mantiene confirmación; `success` con el número borrado |
| `BankStatementUpload` | Importar extracto | `success` con nº importados; error → `error` |

### Suscripciones
| Sitio | Acción | Toast |
|---|---|---|
| `SubscriptionSheet`, alta | Crear / editar | `success` |
| `SubscriptionSheet`, `SubscriptionDialogs` | Borrar | Deshacer (diferido) |
| `SubscriptionSheet`, `SubscriptionDialogs` | Cancelar (end_date = hoy) | Sin confirmación; toast con Deshacer (vuelve a `end_date: null`) |

### Cuentas
| Sitio | Acción | Toast |
|---|---|---|
| `AccountSheet` | Crear / editar | `success` |
| `AccountsBody`, `AccountDetail`, `AccountSheet` | Borrar | Mantiene confirmación; `success` tras borrar; error → `error` |
| `AccountsBody` | Marcar por defecto | Solo error |
| `useReorder` | Reordenar | Solo error (traducido) |
| `JointAccountSection` | Invitar | `success` (ya existía) |
| `JointAccountSection` | Aceptar invitación | `success` |
| `JointAccountSection` | Abandonar | Mantiene confirmación; `info` al salir |

### Categorías
| Sitio | Acción | Toast |
|---|---|---|
| `CategorySheet` | Crear / editar | `success` |
| `CategoriesBody` | Archivar | Toast con Deshacer (desarchiva) |
| `CategoriesBody` | Restaurar | Solo error |
| `CategorySheet`, `CategoriesBody` | Borrar | Mantiene confirmación; `success`; error → `error` |

### Presupuestos
| Sitio | Acción | Toast |
|---|---|---|
| `BudgetSheet` | Crear / editar | `success` |
| `BudgetsBody`, `BudgetSheet` | Borrar | Deshacer (diferido) |
| Tras crear/editar un movimiento | Presupuesto ≥ 90 % | `warning` "Presupuesto X al 90 %" (una vez por cruce de umbral) |

### Amigos y grupos
| Sitio | Acción | Toast |
|---|---|---|
| `FriendsBody` | Enviar solicitud | `info` si queda pendiente, `success` si se acepta directamente |
| `FriendsBody` | Aceptar solicitud | `success` |
| `FriendsBody` | Eliminar amigo | Mantiene confirmación |
| `GroupsBody` | Crear grupo | `success` (además de navegar) |
| `GroupDetail` | Renombrar | `success` (ya existía) |
| `GroupDetail` | Salir del grupo | `info` |
| `GroupDetail` | Archivar | Deshacer (desarchiva), sin confirmación; no cerrar si falla |
| `SharedExpenseSheet` | Crear / editar gasto | `success` |
| `SharedExpenseSheet`, `GroupDetail` | Borrar gasto | Deshacer (diferido) |
| `SettleUpSheet` | Registrar liquidación | `success` con el importe |

### Perfil, ajustes y sesión
| Sitio | Acción | Toast |
|---|---|---|
| `HandleSetup` | Guardar perfil | `success` (ya existía) |
| `LoginForm` | Error OAuth | `error` |
| `SettingsBody` | Cerrar sesión falla | `error` |
| `AddShortcutsOverlay` | Enviar feedback | `success` / `error` (ya existía, texto traducido) |

### Global
- `MutationCache.onError` → `toast.error` con `apiErrorText`.
- Sin conexión / conexión recuperada → `warning` / `info` (un toast con `id` fijo que se actualiza).

## Dónde no se pone toast
- Cambios de tema, idioma, modo privacidad o calendario: se ven al instante.
- Reordenar con éxito y marcar cuenta por defecto: la lista se mueve.
- Rechazar o cancelar solicitudes, quitar miembros: la fila desaparece.
- Validación de formularios: inline junto al campo.
- Error de login por callback: la página ya muestra un aviso.

## Fases
1. **Errores**: `MutationCache.onError` + `apiErrorText`, arreglar los errores silenciosos (deletes con `.catch(() => undefined)`, `DeleteAction` sin `try/catch`, archivar/restaurar sin `onError`, OAuth, `signOut`, archivar grupo que cierra aunque falle), textos fijos a i18n.
2. **Deshacer**: `useUndoableDelete` con borrado diferido; transacciones, suscripciones (borrar y cancelar), presupuestos, gastos compartidos; archivar categoría y grupo.
3. **Éxitos**: crear/editar en todos los sheets, importación, borrado masivo, aceptar amigo/invitación, salir de grupo/cuenta, liquidación, borrar cuenta/categoría.
4. **Avisos**: presupuesto al 90 %, sin conexión.
