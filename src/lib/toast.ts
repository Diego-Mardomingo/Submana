import type { ReactNode } from "react";

/**
 * App-wide toasts (rendered by `<Toaster />` in providers). Look & rules: docs/design/toasts.html.
 *
 *   toast.success("Saved")
 *   toast.error("Couldn't save", { description: "You're offline." })
 *   toast("Expense deleted", { icon: <Trash2 />, action: { label: "Undo", onClick: restore } })
 *   toast.promise(upload(), { loading: "Importing…", success: "Imported", error: (e) => e.message })
 */

export type ToastType = "success" | "error" | "warning" | "info" | "loading" | "neutral";

export type ToastButton = { label: string; onClick: () => void };

export type ToastOptions = {
  /** Reuse an id to update a toast in place instead of adding another one. */
  id?: string | number;
  description?: ReactNode;
  /** Milliseconds before it closes; `Infinity` keeps it until dismissed. Defaults depend on the type. */
  duration?: number;
  /** Main action. Without a description it sits inline next to the title (e.g. "Undo"). */
  action?: ToastButton;
  /** Secondary button next to the action (e.g. "Not now"). */
  cancel?: ToastButton;
  /** Replaces the type icon (neutral toasts mostly: trash, copy…). */
  icon?: ReactNode;
  /** Called once when the toast starts closing, whatever the cause (timeout, close, swipe, a button, `dismiss`). Not called when it is updated in place. */
  onClose?: () => void;
};

export type ToastItem = ToastOptions & {
  id: string | number;
  type: ToastType;
  title: ReactNode;
  duration: number;
  /** Bumped on every update so the countdown restarts. */
  version: number;
  leaving: boolean;
};

/** Visible at once; the rest wait in the queue. */
export const MAX_VISIBLE = 3;
export const EXIT_MS = 200;

const DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 4000,
  neutral: 4000,
  error: 6000,
  loading: Infinity,
};
const ACTION_DURATION = 8000;

function durationFor(type: ToastType, options: ToastOptions) {
  if (options.duration !== undefined) return options.duration;
  if (type === "loading") return Infinity;
  return options.action || options.cancel ? Math.max(ACTION_DURATION, DURATION[type]) : DURATION[type];
}

const NONE: ToastItem[] = [];
let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(next: ToastItem[]) {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => toasts,
  getServerSnapshot: () => NONE,
  /** Drops a toast once its exit animation has played. */
  remove(id: string | number) {
    emit(toasts.filter((item) => item.id !== id));
  },
};

function show(type: ToastType, title: ReactNode, options: ToastOptions = {}) {
  const id = options.id ?? nextId++;
  const existing = toasts.find((item) => item.id === id);
  // An update replaces the content (a resolved promise drops the loading description).
  const item: ToastItem = {
    ...options,
    id,
    type,
    title,
    duration: durationFor(type, options),
    version: (existing?.version ?? 0) + 1,
    leaving: false,
  };
  emit(existing ? toasts.map((t) => (t.id === id ? item : t)) : [...toasts, item]);
  return id;
}

function dismiss(id?: string | number) {
  const closing = toasts.filter((item) => !item.leaving && (id === undefined || item.id === id));
  emit(toasts.map((item) => (closing.includes(item) ? { ...item, leaving: true } : item)));
  closing.forEach((item) => item.onClose?.());
}

type PromiseMessages<T> = {
  loading: ReactNode;
  success: ReactNode | ((data: T) => ReactNode);
  error: ReactNode | ((error: unknown) => ReactNode);
  description?: ReactNode;
};

/** One toast that goes loading → success/error. Returns the original promise. */
function promise<T>(task: Promise<T>, messages: PromiseMessages<T>, options: ToastOptions = {}) {
  const id = show("loading", messages.loading, { ...options, description: messages.description });
  task.then(
    (data) => show("success", typeof messages.success === "function" ? messages.success(data) : messages.success, { ...options, id }),
    (error) => show("error", typeof messages.error === "function" ? messages.error(error) : messages.error, { ...options, id })
  );
  return task;
}

export const toast = Object.assign((title: ReactNode, options?: ToastOptions) => show("neutral", title, options), {
  message: (title: ReactNode, options?: ToastOptions) => show("neutral", title, options),
  success: (title: ReactNode, options?: ToastOptions) => show("success", title, options),
  error: (title: ReactNode, options?: ToastOptions) => show("error", title, options),
  warning: (title: ReactNode, options?: ToastOptions) => show("warning", title, options),
  info: (title: ReactNode, options?: ToastOptions) => show("info", title, options),
  loading: (title: ReactNode, options?: ToastOptions) => show("loading", title, options),
  promise,
  /** Closes one toast, or all of them without an id. */
  dismiss,
});
