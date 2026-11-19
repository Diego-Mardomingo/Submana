# Submana — notes for agents and contributors

## Mockups

Visual changes get a mockup before they're built, and the user approves it first. By default the mockup is a throwaway HTML file (in a scratch folder, not committed) shown to the user in the chat: the "now" next to the proposal, both themes, the tokens from `globals.css` and the components' real classes and styles. Use the "Submana Mockups" artifact (https://claude.ai/artifact/N3qmuq3p9dHkhTuebsYP7o) only when the user asks for it: republishing it means reading the whole file first (over 500 KB). The older mockups stay in `docs/design/`.

The rest of this section is about the artifact. One hash view per proposal (`<section data-view="…">`) plus a card on its `#inicio` view; the "Rediseño de los toasts" view (`#toasts`) is the model to copy.

- Each screen is a `<figure class="kit-screen">` with a `<template>` inside, drawn in an iframe of the device's width (phone 390, `data-device="desktop"` 1280) with the app's real CSS. Write the markup with the components' real classes. The page's own script explains the placeholders (`<kit-include ref>`, `<img data-logo>`, `<i data-lucide>`, `<i data-app-icon>`, `data-new`).
- Show what changes: a "now" screen next to the proposal (`data-original` keeps the app's current CSS), a prototype people can play with when behaviour matters (a `.d-proto` with buttons `data-demo="name" [data-value]` that call `demo(name, value)` inside the iframe), and both themes (the toolbar switches them).
- CSS a proposal adds goes in a `<style class="kit-proposal">` inside its view, so it only reaches that view's screens; `data-replaces="toast"` drops `app/toast.css` for them when the proposal rewrites a whole file. Write it as it will land in the app.
- The artifact publishes `src/app/*.css` under `app/`, plus `kit/modules.css` (the CSS modules with their classes prefixed by file name, built by the artifact's `kit/build-modules.mjs`) and `kit/screen.css`. Republish them whenever the app's CSS changes, so the mockups keep matching the app.
- Open questions go in the view's decisions block (`QUESTIONS` entries with its `view`, the proposed option marked). The answers are stored in the artifact's database (`decisions` collection); read them before building.
- Before publishing, serve the files locally and screenshot the screens to check they render.

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
