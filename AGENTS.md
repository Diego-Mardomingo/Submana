# Submana — notes for agents and contributors

## UI conventions

### Toasts

Use the app's own toasts. Do **not** use `sonner` (ESLint blocks it).

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

Options: `description`, `action` / `cancel` (`{ label, onClick }`), `icon`, `duration`, `id` (reuse it to update a toast in place), `onClose` (runs once when it closes, whatever the cause). `toast.dismiss(id?)` closes one or all.

Rules:
- Text goes through i18n (`t(...)`), never hard-coded. Short title (≤ ~40 chars); details go in `description` (clamped to 3 lines).
- Prefer an **Undo** toast over a confirm dialog for reversible deletes: `useUndoableDelete` (`src/hooks/useUndoableDelete.tsx`) hides the item and only sends the DELETE when the toast closes. Keep the confirm for what can't be undone or takes other data with it (an account and its transactions).
- Confirm what the user did (created, saved, deleted) even if the screen also shows it. Don't fire several toasts that say the same thing; a separate consequence (a budget reaching 90 % after saving an expense) gets its own toast.
- Durations are set by type (4s, errors 6s, with buttons 8s, loading until resolved); only override `duration` for a reason.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
