"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert, X } from "lucide-react";
import { DismissableLayer } from "radix-ui/internal";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslations } from "@/lib/i18n/utils";
import { EXIT_MS, MAX_VISIBLE, toast, toastStore, type ToastButton, type ToastItem, type ToastType } from "@/lib/toast";

const ICONS: Record<ToastType, typeof Info> = {
  success: CircleCheck,
  error: OctagonX,
  warning: TriangleAlert,
  info: Info,
  loading: LoaderCircle,
  neutral: Info,
};

const GAP = 8;
/** Collapsed deck (phones): how far each card behind the front one peeks out. */
const PEEK = 8;
const SWIPE_DISMISS_PX = 70;

/** Renders the toasts fired with `toast` from `@/lib/toast`. Mounted once, in providers. */
export function Toaster() {
  const lang = useLang();
  const t = useTranslations(lang);
  const all = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getServerSnapshot);
  const phone = useMediaQuery("(max-width: 767px)");
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [hovered, setHovered] = useState(false);
  const [opened, setOpened] = useState(false);
  const [hidden, setHidden] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const onHeight = useCallback(
    (id: ToastItem["id"], height: number) => setHeights((prev) => (prev[String(id)] === height ? prev : { ...prev, [String(id)]: height })),
    []
  );

  // Newest first; older ones wait (paused) until a newer one closes.
  const visible = all.slice(-MAX_VISIBLE).reverse();
  const expanded = !phone || (opened && visible.length > 1);
  const paused = hovered || (phone && expanded) || hidden;

  // Top layer: above sheets and dialogs, whatever their z-index.
  useEffect(() => {
    const el = ref.current;
    if (el && "showPopover" in el && !el.matches(":popover-open")) el.showPopover();
  }, [visible.length]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // An expanded deck folds back on a tap elsewhere.
  useEffect(() => {
    if (!opened) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpened(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [opened]);

  const sizes = visible.map((item) => heights[String(item.id)] ?? 0);
  const frontHeight = sizes[0] ?? 0;
  // Expanded: each card sits on top of the newer ones. Collapsed: a deck that peeks out.
  const offsets = sizes.map((_, index) => (expanded ? sizes.slice(0, index).reduce((sum, h) => sum + h + GAP, 0) : index * PEEK));
  const stackHeight = expanded ? sizes.reduce((sum, h) => sum + h, 0) + GAP * Math.max(0, sizes.length - 1) : frontHeight + Math.max(0, sizes.length - 1) * PEEK;

  return (
    // A branch of every Radix layer: tapping a toast doesn't close the open sheet or dialog.
    <DismissableLayer.Branch asChild>
      <section
        ref={ref}
        popover="manual"
        className="toaster"
        aria-label={t("toast.region")}
        aria-live="polite"
        data-expanded={expanded}
        data-paused={paused}
        style={{ height: stackHeight }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          if (phone && !expanded && !(e.target as HTMLElement).closest("button")) setOpened(true);
        }}
      >
        <ol>
          {visible.map((item, index) => (
            <ToastCard
              key={item.id}
              item={item}
              front={index === 0}
              collapsed={!expanded}
              y={offsets[index]}
              index={index}
              frontHeight={frontHeight}
              closeLabel={t("toast.close")}
              onHeight={onHeight}
            />
          ))}
        </ol>
      </section>
    </DismissableLayer.Branch>
  );
}

type CardProps = {
  item: ToastItem;
  front: boolean;
  collapsed: boolean;
  y: number;
  index: number;
  frontHeight: number;
  closeLabel: string;
  onHeight: (id: ToastItem["id"], height: number) => void;
};

function ToastCard({ item, front, collapsed, y, index, frontHeight, closeLabel, onHeight }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const { id, type, title, description, action, cancel, duration, version, leaving } = item;
  const Icon = ICONS[type];
  const inlineAction = action && !description && !cancel;
  const buttons = (action || cancel) && !inlineAction;
  const press = (button: ToastButton) => {
    button.onClick();
    toast.dismiss(id);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => onHeight(id, el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onHeight]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => toastStore.remove(id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, id]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    swipe.current = { x: e.clientX, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (swipe.current?.id === e.pointerId) setDx(e.clientX - swipe.current.x);
  };
  const onPointerUp = () => {
    if (!swipe.current) return;
    swipe.current = null;
    if (Math.abs(dx) > SWIPE_DISMISS_PX) toast.dismiss(id);
    else setDx(0);
  };

  return (
    <li
      className="toaster-item"
      data-front={front}
      style={
        {
          "--y": `${-y}px`,
          "--scale": collapsed ? 1 - index * 0.05 : 1,
          "--deck-h": collapsed && !front ? `${frontHeight}px` : undefined,
          zIndex: MAX_VISIBLE - index,
        } as React.CSSProperties
      }
      aria-hidden={collapsed && !front ? true : undefined}
    >
      <div
        ref={ref}
        className="toast"
        data-type={type}
        data-compact={!description && !buttons}
        data-leaving={leaving}
        data-swiping={dx !== 0}
        role={type === "error" ? "alert" : "status"}
        style={{ "--swipe-x": `${dx}px` } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="toast-icon" aria-hidden>
          {item.icon ?? <Icon />}
        </span>
        <div className="toast-body">
          <div className="toast-title">{title}</div>
          {description && <div className="toast-desc">{description}</div>}
          {buttons && (
            <div className="toast-actions">
              {action && (
                <button type="button" className="toast-btn is-primary" onClick={() => press(action)}>
                  {action.label}
                </button>
              )}
              {cancel && (
                <button type="button" className="toast-btn" onClick={() => press(cancel)}>
                  {cancel.label}
                </button>
              )}
            </div>
          )}
        </div>
        {inlineAction && action && (
          <button type="button" className="toast-inline-action" onClick={() => press(action)}>
            {action.label}
          </button>
        )}
        {type !== "loading" && !inlineAction && (
          <button type="button" className="toast-close" aria-label={closeLabel} onClick={() => toast.dismiss(id)}>
            <X />
          </button>
        )}
        {Number.isFinite(duration) && (
          // The countdown is this bar's animation: pausing it pauses the timer.
          <span key={version} className="toast-progress" style={{ animationDuration: `${duration}ms` }} onAnimationEnd={() => toast.dismiss(id)} aria-hidden />
        )}
      </div>
    </li>
  );
}
