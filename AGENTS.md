# Submana — notes for agents and contributors

## UI conventions

### Toasts

Use the app's own toasts. Do **not** use `sonner` (ESLint blocks it outside the legacy files listed in `eslint.config.mjs`).

- API: `import { toast } from "@/lib/toast"`. `<Toaster />` is already mounted in `src/app/providers.tsx`; never mount another.
- Design reference: open `docs/design/toasts.html` in a browser. Styles live in `src/app/toast.css` and use only the theme tokens from `globals.css` (`--success`, `--danger`, `--warning`, `--info`, `--accent` and their `-soft` variants). Don't restyle toasts per screen. Change the design in `toast.css` and `toasts.html` together.

Pick the type by meaning:

| Call | When |
| --- | --- |
| `toast.success(title)` | An action the user did worked (saved, created, sent) |
| `toast.error(title, { description })` | It failed; say why or what to do in the description |
| `toast.warning(title)` | Worked or needs attention, but something is off (budget at 90%, renewal tomorrow) |
| `toast.info(title)` | Neutral news not caused by an error (request sent, mode enabled) |
| `toast(title, { icon })` | Plain confirmation with a custom icon (copied, deleted) |
| `toast.promise(task, { loading, success, error })` | Anything slow (imports, uploads); one toast goes loading → result |

Options: `description`, `action` / `cancel` (`{ label, onClick }`), `icon`, `duration`, `id` (reuse it to update a toast in place). `toast.dismiss(id?)` closes one or all.

Rules:
- Text goes through i18n (`t(...)`), never hard-coded. Short title (≤ ~40 chars); details go in `description` (clamped to 3 lines).
- Prefer an **Undo** action (`toast(t("…"), { icon: <Trash2 />, action: { label: t("…"), onClick: restore } })`) over a confirm dialog for reversible deletes.
- Don't toast what the screen already shows (a row appearing in a list), and don't fire several toasts for one action.
- Durations are set by type (4s, errors 6s, with buttons 8s, loading until resolved); only override `duration` for a reason.

Migrating the remaining `sonner` calls: switch the import to `@/lib/toast` (same `toast.success/error` API), remove the file from `legacySonner` in `eslint.config.mjs`; when the list is empty, remove `SonnerToaster`, `src/components/ui/sonner.tsx` and the `sonner` dependency.
