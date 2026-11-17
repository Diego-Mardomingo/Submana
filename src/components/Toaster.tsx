"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { DismissableLayer } from "radix-ui/internal";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { EXIT_MS, MAX_VISIBLE, toast, toastLayout, toastStore, type ToastButton, type ToastItem, type ToastSubject, type ToastType } from "@/lib/toast";

/** Solid glyphs (see .toast-glyph): the first shape is filled, the mark is cut out of it. */
const GLYPHS: Partial<Record<ToastType, typeof Info>> = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
};

const GAP = 8;
/** Collapsed deck (phones): how far each card behind the front one peeks out. */
const PEEK = 8;
const SWIPE_DISMISS_PX = 60;
/** Dragging towards the top edge closes it sooner than sideways. */
const SWIPE_UP_DISMISS_PX = 28;

type Size = { w: number; h: number };

/** Renders the toasts fired with `toast` from `@/lib/toast`. Mounted once, in providers. */
export function Toaster() {
  const lang = useLang();
  const t = useTranslations(lang);
  const all = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getServerSnapshot);
  const phone = useMediaQuery("(max-width: 767px)");
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [hovered, setHovered] = useState(false);
  const [opened, setOpened] = useState(false);
  const [hidden, setHidden] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const onSize = useCallback(
    (id: ToastItem["id"], size: Size) =>
      setSizes((prev) => {
        const old = prev[String(id)];
        return old && old.w === size.w && old.h === size.h ? prev : { ...prev, [String(id)]: size };
      }),
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

  const measured = visible.map((item) => sizes[String(item.id)] ?? { w: 0, h: 0 });
  const front = measured[0] ?? { w: 0, h: 0 };
  // Expanded: each card sits below the newer ones. Collapsed: a deck that peeks out below the front one.
  const offsets = measured.map((_, index) => (expanded ? measured.slice(0, index).reduce((sum, s) => sum + s.h + GAP, 0) : index * PEEK));
  const stackHeight = expanded
    ? measured.reduce((sum, s) => sum + s.h, 0) + GAP * Math.max(0, measured.length - 1)
    : front.h + Math.max(0, measured.length - 1) * PEEK;

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
          if (phone && !expanded && visible.length > 1 && !(e.target as HTMLElement).closest("button")) setOpened(true);
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
              deck={front}
              closeLabel={t("toast.close")}
              onSize={onSize}
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
  /** Size of the front toast, which the cards behind it take in a collapsed deck. */
  deck: Size;
  closeLabel: string;
  onSize: (id: ToastItem["id"], size: Size) => void;
};

function ToastCard({ item, front, collapsed, y, index, deck, closeLabel, onSize }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const { id, type, title, description, subject, action, cancel, duration, version, leaving } = item;
  const { size, inlineAction } = toastLayout(item);
  const timed = Number.isFinite(duration);
  const behind = collapsed && !front;
  const Glyph = GLYPHS[type];
  const press = (button: ToastButton) => {
    button.onClick();
    toast.dismiss(id);
  };
  const timeout = () => toast.dismiss(id);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => onSize(id, { w: el.offsetWidth, h: el.offsetHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onSize]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => toastStore.remove(id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, id]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (swipe.current?.id !== e.pointerId) return;
    const dy = e.clientY - swipe.current.y;
    // Up, towards the edge, it follows the finger; down it resists.
    setDrag({ x: e.clientX - swipe.current.x, y: dy < 0 ? dy : dy * 0.15 });
  };
  const onPointerUp = () => {
    if (!swipe.current) return;
    swipe.current = null;
    if (Math.abs(drag.x) > SWIPE_DISMISS_PX || drag.y < -SWIPE_UP_DISMISS_PX) toast.dismiss(id);
    else setDrag({ x: 0, y: 0 });
  };
  const swiping = Math.abs(drag.x) + Math.abs(drag.y) > 4;

  return (
    <li
      className="toaster-item"
      data-front={front}
      style={
        {
          "--y": `${y}px`,
          "--scale": collapsed ? 1 - index * 0.05 : 1,
          "--deck-w": behind ? `${deck.w}px` : undefined,
          "--deck-h": behind ? `${deck.h}px` : undefined,
          zIndex: MAX_VISIBLE - index,
        } as React.CSSProperties
      }
      aria-hidden={behind ? true : undefined}
    >
      <div
        ref={ref}
        className="toast"
        data-type={type}
        data-size={size}
        data-leaving={leaving}
        data-swiping={swiping}
        role={type === "error" ? "alert" : "status"}
        style={{ "--swipe-x": `${drag.x}px`, "--swipe-y": `${drag.y}px` } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Keyed by type: it remounts (and pops in) when a loading toast resolves. */}
        <span key={type} className="toast-icon" aria-hidden>
          {type === "loading" ? <Spinner /> : (item.icon ?? (Glyph ? <Glyph className="toast-glyph" /> : <Info />))}
        </span>
        <div className="toast-body">
          <div className="toast-title">{title}</div>
          {description && <div className="toast-desc">{description}</div>}
          {subject && <Subject subject={subject} />}
          {cancel && (
            <div className="toast-actions">
              {action && (
                <button type="button" className="toast-btn is-primary" onClick={() => press(action)}>
                  {action.label}
                </button>
              )}
              <button type="button" className="toast-btn" onClick={() => press(cancel)}>
                {cancel.label}
              </button>
            </div>
          )}
        </div>
        {inlineAction && action && (
          <button type="button" className="toast-inline-action" onClick={() => press(action)}>
            {/* The ring is the countdown: pausing its animation pauses the toast. */}
            {timed && (
              <svg key={version} className="toast-ring" viewBox="0 0 16 16" aria-hidden>
                <circle className="toast-ring-track" cx="8" cy="8" r="6.5" />
                <circle className="toast-ring-left" cx="8" cy="8" r="6.5" pathLength={100} style={{ animationDuration: `${duration}ms` }} onAnimationEnd={timeout} />
              </svg>
            )}
            {action.label}
          </button>
        )}
        {type !== "loading" && (
          <button type="button" className="toast-close" aria-label={closeLabel} onClick={() => toast.dismiss(id)}>
            <X />
          </button>
        )}
        {timed && !inlineAction && <span key={version} className="toast-timer" style={{ animationDuration: `${duration}ms` }} onAnimationEnd={timeout} aria-hidden />}
      </div>
    </li>
  );
}

function Spinner() {
  return (
    <svg className="toast-spinner" viewBox="0 0 24 24">
      <circle className="track" cx="12" cy="12" r="9" />
      <circle className="arc" cx="12" cy="12" r="9" pathLength={100} />
    </svg>
  );
}

function Subject({ subject: { icon, label, amount, signed } }: { subject: ToastSubject }) {
  const hideAmounts = usePrivacyMode();
  const money = amount === undefined ? null : signed ? `${amount >= 0 ? "+" : "-"}${formatCurrency(Math.abs(amount))}` : formatCurrency(amount);
  return (
    <div className="toast-subject">
      {icon && (
        <span className="toast-subject-icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="toast-subject-label">{label}</span>
      {money && (
        <>
          <span className="toast-subject-sep" aria-hidden>
            ·
          </span>
          <span className={`toast-subject-amount${hideAmounts ? " sensitive-amount-blur" : ""}`}>{money}</span>
        </>
      )}
    </div>
  );
}
