# Submana — notes for agents and contributors

## Mockups

Visual changes get a mockup before they're built, and the user approves it first. New proposals go in the "Submana Canvas" artifact (https://claude.ai/artifact/Cp74oL4LxTuzY3UMFb1rZi), a Design canvas: one page per proposal (named after its issue, e.g. "#123 Pulido de UX"), one interactive artboard per screen (Play to try it), and the open questions in a sticky note and in the reply. Earlier proposals stay in the "Submana Mockups" artifact (https://claude.ai/artifact/N3qmuq3p9dHkhTuebsYP7o) and in `docs/design/`.

- Each artboard is a 390×844 phone drawn with the app's real CSS: `<link rel="stylesheet" href="<kit url>">` in its `<head>` after the `support.js` line, and a root `<div class="kit-phone">` (`docs/design/canvas/base.css` explains it). Write the markup with the components' real classes; copy an existing artboard (`project/Suscripciones.dc.html`) for the bottom bar, toasts and swipe rows. Styles a proposal adds go in the artboard's `<helmet><style>`, commented with the app file they'll move to.
- The kit is one stylesheet built by `node docs/design/canvas/build-kit.mjs <out file>` from `src/app/*.css`, the CSS modules (classes prefixed by file name: `Navigation_bar`) and `base.css`. Whenever the app's CSS changes, rebuild it, upload it as an asset of the canvas and point the artboards' `<link>` at the new `/_blob/…` url.
- Each artboard has the tweaks `tema` (dark/light, sets `<html data-theme>`) and `marcarNuevo` (dashed outline on `[data-new]`, what the proposal changes).

## UI conventions

### Toasts

Use the app's own toasts. Do **not** use `sonner` (ESLint blocks it).

- API: `import { toast } from "@/lib/toast"`. `<Toaster />` is already mounted in `src/app/providers.tsx`; never mount another.
- Design reference: the "Rediseño de los toasts" view of the Submana Mockups artifact (https://claude.ai/artifact/N3qmuq3p9dHkhTuebsYP7o#toasts). An inverted surface at the top of the screen: a pill when there is only a title, a card with a description, a `subject` or two buttons; the type colour is only in the icon. Styles live in `src/app/toast.css` and use only the theme tokens from `globals.css`. Don't restyle toasts per screen.

Pick the type by meaning:

| Call | When |
| --- | --- |
| `toast.success(title)` | An action the user did worked (saved, created, sent) |
| `toast.error(title, { description })` | It failed; say why or what to do in the description |
| `toast.warning(title)` | Worked or needs attention, but something is off (budget at 90%, renewal tomorrow) |
| `toast.info(title)` | Neutral news not caused by an error (request sent, mode enabled) |
| `toast(title, { icon })` | Plain confirmation with a custom icon (copied, deleted) |
| `toast.promise(task, { loading, success, error })` | Anything slow (imports, uploads); one toast goes loading → result |

Options: `description`, `subject` (`{ icon, label, amount, signed }`: the item the toast is about, under the title), `action` / `cancel` (`{ label, onClick }`; one action sits inline with a ring that counts down, two go in a row), `icon`, `duration`, `id` (reuse it to update a toast in place), `onClose` (runs once when it closes, whatever the cause). `toast.dismiss(id?)` closes one or all.

Rules:
- Text goes through i18n (`t(...)`), never hard-coded. Short title (≤ ~40 chars); details go in `description` (clamped to 3 lines).
- Prefer an **Undo** toast over a confirm dialog for reversible deletes: `useUndoableDelete` (`src/hooks/useUndoableDelete.tsx`) hides the item and only sends the DELETE when the toast closes. Keep the confirm for what can't be undone or takes other data with it (an account and its transactions).
- Confirm what the user did (created, saved, deleted) even if the screen also shows it, with its `subject` (builders in `src/lib/toastSubjects.tsx`; `useUndoableDelete` takes one too). Don't fire several toasts that say the same thing; a separate consequence (a budget reaching 90 % after saving an expense) gets its own toast.
- Durations are set by type (4s, errors 6s, with buttons 8s, loading until resolved); only override `duration` for a reason.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
