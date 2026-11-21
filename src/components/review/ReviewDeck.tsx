"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, CircleHelp, Clock, HandCoins, Repeat, Settings2, Sparkles, Split, Undo2, Users, X } from "lucide-react";
import { ReviewCategorySheet } from "@/components/review/ReviewCategorySheet";
import { ReviewGroupFlow, type GroupFlow } from "@/components/review/ReviewGroupFlow";
import { ReviewSettingsSheet } from "@/components/review/ReviewSettingsSheet";
import { SubscriptionSheet } from "@/components/SubscriptionSheet";
import { Spinner } from "@/components/ui/spinner";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { calendarDayInAppTimeZone } from "@/lib/date";
import { useReviewAction, useReviewQueue } from "@/hooks/useReview";
import { formatCurrency } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import type { UIKey } from "@/lib/i18n/ui";
import { merchantName, samePair, type CategoryPair } from "@/lib/review/classify";
import type { ReviewItem, ReviewQueue, ReviewUndo } from "@/lib/review/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Dir = "yes" | "later";
type Exit = Dir | "down";

/** What the user changed on a card before deciding. */
interface Edit {
  pair: CategoryPair | null;
  /** Remember it for the merchant (a rule). */
  learn: boolean;
}

interface HistoryEntry {
  id: string;
  exit: Exit;
  dir: Dir;
  edit: Edit | undefined;
  /** Arrives with the server's answer; until then the card can't be put back. */
  undo?: ReviewUndo;
}

interface DeckState {
  items: Map<string, ReviewItem>;
  order: string[];
  total: string[];
  results: Record<string, Dir>;
  edits: Record<string, Edit>;
  history: HistoryEntry[];
  /** "Amazon → Technology", by movement, for the summary at the end. */
  learned: Record<string, string>;
}

const fresh = (queue: ReviewQueue): DeckState => ({
  items: new Map(queue.items.map((item) => [item.id, item])),
  order: queue.items.map((item) => item.id),
  total: queue.items.map((item) => item.id),
  results: {},
  edits: {},
  history: [],
  learned: {},
});

/** Past this the card goes when let go; a quick flick goes even if shorter. */
const SWIPE_PX = 110;
const FLICK_SPEED = 0.6;
const LEAVE_MS = 430;

/** The review deck: a full-screen stack of cards, one per movement the app isn't sure about. */
export default function ReviewDeck() {
  const router = useRouter();
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: queue, isLoading, refetch } = useReviewQueue();
  const [deck, setDeck] = useState<DeckState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reloading, setReloading] = useState(false);

  // The deck is a snapshot: refreshes elsewhere (realtime, other tabs) must not reshuffle the cards under the finger.
  if (queue && !deck && !reloading) setDeck(fresh(queue));

  const reload = async () => {
    setReloading(true);
    const { data } = await refetch();
    setDeck(data ? fresh(data) : null);
    setReloading(false);
  };

  const close = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <div className="rv-screen" data-no-pull>
      <header className="rv-head">
        <button type="button" className="sheet-icon-btn" aria-label={t("review.close")} onClick={close}>
          <X className="size-[18px]" />
        </button>
        <div className="rv-head-title">
          <b>{t("review.title")}</b>
          {deck && deck.total.length > 0 && (
            <span>
              {interpolate(t("review.counter"), {
                n: String(Math.min(Object.keys(deck.results).length + 1, deck.total.length)),
                total: String(deck.total.length),
              })}
            </span>
          )}
        </div>
        <button type="button" className="sheet-icon-btn" aria-label={t("review.settings")} onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-[18px]" />
        </button>
      </header>

      {!deck || reloading ? (
        <div className="rv-loading">{isLoading || reloading ? <Spinner className="size-6 text-muted-foreground" /> : null}</div>
      ) : (
        <Deck deck={deck} setDeck={setDeck} hasGroups={!!queue?.hasGroups} onClose={close} />
      )}

      <ReviewSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} onModeChange={reload} />
    </div>
  );
}

function Deck({ deck, setDeck, hasGroups, onClose }: { deck: DeckState; setDeck: React.Dispatch<React.SetStateAction<DeckState | null>>; hasGroups: boolean; onClose: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const action = useReviewAction();
  const { data: categories } = useCategories();
  const lookup = useCategoryLookup();
  const [leaving, setLeaving] = useState<{ id: string; exit: Exit; dy: number }[]>([]);
  const [entering, setEntering] = useState<{ id: string; exit: Exit } | null>(null);
  const [sheet, setSheet] = useState<"category" | "subscription" | null>(null);
  const [groupFlow, setGroupFlow] = useState<GroupFlow | null>(null);
  const [pops, setPops] = useState(0);

  const topId = deck.order[0];
  const top = topId ? deck.items.get(topId) : undefined;
  const excluded = useMemo(() => categories?.defaultCategories.find((c) => c.exclude_from_metrics && !c.parent_id), [categories]);

  const pairOf = (item: ReviewItem): CategoryPair => deck.edits[item.id]?.pair ?? { category_id: item.category_id, subcategory_id: item.subcategory_id };
  const pairLabel = (pair: CategoryPair) => {
    const id = pair.subcategory_id ?? pair.category_id;
    return id ? (lookup.name.get(id) ?? "") : "";
  };
  const pairEmoji = (pair: CategoryPair) => (pair.subcategory_id && lookup.emoji.get(pair.subcategory_id)) || (pair.category_id && lookup.emoji.get(pair.category_id)) || "";

  const setEdit = (id: string, edit: Edit | undefined) =>
    setDeck((d) => {
      if (!d) return d;
      const edits = { ...d.edits };
      if (edit) edits[id] = edit;
      else delete edits[id];
      return { ...d, edits };
    });

  /** Decide the top card. `edit` overrides what the card has (e.g. "not an expense"). */
  const commit = (dir: Dir, opts: { exit?: Exit; dy?: number; edit?: Edit; allowEmpty?: boolean } = {}) => {
    if (!top) return;
    const item = top;
    const edit = opts.edit ?? deck.edits[item.id];
    const pair = edit?.pair ?? pairOf(item);
    // Nothing to confirm without a category: ask for one instead.
    if (dir === "yes" && !pair.category_id && !opts.allowEmpty) {
      setSheet("category");
      return;
    }
    const changed = !!edit?.pair && !samePair(edit.pair, item);
    const exit = opts.exit ?? dir;
    haptic();
    setLeaving((list) => [...list, { id: item.id, exit, dy: opts.dy ?? 0 }]);
    window.setTimeout(() => setLeaving((list) => list.filter((l) => l.id !== item.id)), LEAVE_MS);
    setDeck((d) =>
      d && {
        ...d,
        order: d.order.filter((id) => id !== item.id),
        results: { ...d.results, [item.id]: dir },
        history: [...d.history, { id: item.id, exit, dir, edit: deck.edits[item.id] }],
        learned:
          dir === "yes" && changed && edit?.learn && item.pattern
            ? { ...d.learned, [item.id]: `${merchantName(item.description) || item.pattern} → ${pairLabel(pair)}` }
            : d.learned,
      }
    );
    action.mutate(
      dir === "yes" ? { id: item.id, action: "confirm", ...(changed && { category: pair }), learn: changed && !!edit?.learn } : { id: item.id, action: "later" },
      {
        onSuccess: ({ undo }) => setDeck((d) => d && { ...d, history: d.history.map((h) => (h.id === item.id && !h.undo ? { ...h, undo } : h)) }),
        onError: () => {
          toast.error(t("review.error"));
          setDeck((d) => {
            if (!d) return d;
            const results = { ...d.results };
            delete results[item.id];
            const learned = { ...d.learned };
            delete learned[item.id];
            return { ...d, order: [item.id, ...d.order.filter((id) => id !== item.id)], results, learned, history: d.history.filter((h) => h.id !== item.id) };
          });
        },
      }
    );
  };

  const last = deck.history.at(-1);
  const undo = () => {
    if (!last?.undo) return;
    const entry = last;
    haptic();
    setDeck((d) => {
      if (!d) return d;
      const results = { ...d.results };
      delete results[entry.id];
      const learned = { ...d.learned };
      delete learned[entry.id];
      const edits = { ...d.edits };
      if (entry.edit) edits[entry.id] = entry.edit;
      return { ...d, order: [entry.id, ...d.order], results, learned, edits, history: d.history.slice(0, -1) };
    });
    setLeaving((list) => list.filter((l) => l.id !== entry.id));
    setEntering({ id: entry.id, exit: entry.exit });
    action.mutate({ id: entry.id, action: "restore", undo: entry.undo! }, { onError: () => toast.error(t("review.error")) });
  };

  // Desktop: arrows decide, backspace undoes (not while a sheet is open).
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (sheet || groupFlow || document.querySelector("[role='dialog']")) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight") commit("yes");
    else if (e.key === "ArrowLeft") commit("later");
    else if (e.key === "Backspace") undo();
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const chooseAlternative = (pair: CategoryPair) => {
    if (!top) return;
    setEdit(top.id, { pair, learn: true });
    setPops((n) => n + 1);
  };

  const notCounted = () => {
    if (!top || !excluded) return;
    commit("yes", { exit: "down", edit: { pair: { category_id: excluded.id, subcategory_id: null }, learn: false } });
    toast(t(top.type === "income" ? "review.notIncomeToast" : "review.notExpenseToast"), { icon: <ArrowLeftRight /> });
  };

  const done = deck.order.length === 0;
  const total = deck.total.length;
  const shown = deck.order.slice(0, 4);

  return (
    <>
      {total > 0 && (
        <div className="rv-progress" aria-hidden>
          {deck.total.map((id) => (
            <i key={id} className={deck.results[id] === "later" ? "is-later" : deck.results[id] ? "is-done" : undefined} />
          ))}
        </div>
      )}

      {done ? (
        <DoneView deck={deck} onClose={onClose} />
      ) : (
        <div className="rv-deck">
          {/* One list, keyed by movement: a card that leaves keeps its element (and where the finger left it). */}
          {[...leaving.filter((l) => !shown.includes(l.id)).map((l) => l.id), ...[...shown].reverse()].map((id) => {
            const item = deck.items.get(id)!;
            const out = leaving.find((l) => l.id === id && !shown.includes(id));
            if (out) return <ReviewCard key={id} item={item} pair={pairOf(item)} depth={0} leaving={{ exit: out.exit, dy: out.dy }} labels={{ pairLabel, pairEmoji }} />;
            const depth = shown.indexOf(id);
            return (
              <ReviewCard
                key={id}
                item={item}
                pair={pairOf(item)}
                edit={deck.edits[id]}
                depth={depth}
                pop={depth === 0 ? pops : 0}
                enterFrom={entering?.id === id ? entering.exit : undefined}
                onEntered={() => setEntering(null)}
                labels={{ pairLabel, pairEmoji }}
                hasGroups={hasGroups}
                onSwipe={(dir, dy) => commit(dir, { dy })}
                onPickCategory={() => setSheet("category")}
                onAlternative={chooseAlternative}
                onToggleLearn={() => {
                  const edit = deck.edits[id];
                  if (edit) setEdit(id, { ...edit, learn: !edit.learn });
                }}
                onShare={() => setGroupFlow({ kind: "share", item })}
                onSettle={() => setGroupFlow({ kind: "settle", item })}
                onSubscription={() => setSheet("subscription")}
                onNotCounted={notCounted}
                onCounted={() => {
                  setEdit(id, { pair: { category_id: null, subcategory_id: null }, learn: false });
                  setSheet("category");
                }}
              />
            );
          })}
        </div>
      )}

      {!done && (
        <div className="rv-controls">
          <button type="button" className="rv-ctl" onClick={() => commit("later")}>
            <span className="rv-ctl-btn">
              <Clock />
            </span>
            {t("review.later")}
          </button>
          <button type="button" className="rv-ctl rv-ctl--undo" aria-label={t("review.undo")} disabled={!last?.undo} onClick={undo}>
            <span className="rv-ctl-btn">
              <Undo2 />
            </span>
            {t("review.undo")}
          </button>
          <button type="button" className="rv-ctl rv-ctl--yes" onClick={() => commit("yes")}>
            <span className="rv-ctl-btn">
              <Check />
            </span>
            {t("review.confirm")}
          </button>
        </div>
      )}

      {top && (
        <ReviewCategorySheet
          open={sheet === "category"}
          onOpenChange={(open) => !open && setSheet(null)}
          item={top}
          pair={pairOf(top)}
          learn={deck.edits[top.id]?.learn ?? true}
          onPick={(pair, learn) => {
            setEdit(top.id, samePair(pair, top) ? undefined : { pair, learn });
            setSheet(null);
            setPops((n) => n + 1);
          }}
        />
      )}

      {top && (
        <SubscriptionSheet
          open={sheet === "subscription"}
          onOpenChange={(open) => !open && setSheet(null)}
          draft={{ service_name: merchantName(top.description), cost: top.amount, start_date: calendarDayInAppTimeZone(top.date), account_id: top.account?.id ?? null }}
          // Now a subscription charge: it can go without a category, like the other charges of subscriptions.
          onSaved={() => window.setTimeout(() => commit("yes", { allowEmpty: true }), 250)}
        />
      )}

      <ReviewGroupFlow
        flow={groupFlow}
        onClose={() => setGroupFlow(null)}
        onSaved={(kind) =>
          window.setTimeout(() => {
            // Money someone paid back is not income: without a category of its own it is left out of the totals.
            if (kind === "settle" && top && !pairOf(top).category_id && excluded) commit("yes", { edit: { pair: { category_id: excluded.id, subcategory_id: null }, learn: false } });
            else commit("yes");
          }, 250)
        }
      />
    </>
  );
}

const KIND: Record<string, { icon: React.ComponentType<{ className?: string }>; key: UIKey }> = {
  doubt: { icon: CircleHelp, key: "review.kind.doubt" },
  settle: { icon: CircleHelp, key: "review.kind.doubt" },
  new: { icon: Sparkles, key: "review.kind.new" },
  transfer: { icon: ArrowLeftRight, key: "review.kind.transfer" },
  sure: { icon: Check, key: "review.kind.sure" },
  linked: { icon: Repeat, key: "review.kind.linked" },
};

interface CardLabels {
  pairLabel: (pair: CategoryPair) => string;
  pairEmoji: (pair: CategoryPair) => string;
}

function ReviewCard({
  item,
  pair,
  edit,
  depth,
  pop = 0,
  leaving,
  enterFrom,
  onEntered,
  labels,
  hasGroups,
  onSwipe,
  onPickCategory,
  onAlternative,
  onToggleLearn,
  onShare,
  onSettle,
  onSubscription,
  onNotCounted,
  onCounted,
}: {
  item: ReviewItem;
  pair: CategoryPair;
  edit?: Edit;
  depth: number;
  pop?: number;
  leaving?: { exit: Exit; dy: number };
  enterFrom?: Exit;
  onEntered?: () => void;
  labels: CardLabels;
  hasGroups?: boolean;
  onSwipe?: (dir: Dir, dy: number) => void;
  onPickCategory?: () => void;
  onAlternative?: (pair: CategoryPair) => void;
  onToggleLearn?: () => void;
  onShare?: () => void;
  onSettle?: () => void;
  onSubscription?: () => void;
  onNotCounted?: () => void;
  onCounted?: () => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; time: number; dx: number; dy: number } | null>(null);
  const kindKey = item.subscription ? "linked" : item.review_reason;
  const kind = KIND[kindKey] ?? KIND.doubt;
  const name = merchantName(item.description || item.bank_description);
  const raw = item.bank_description || item.description || "";
  const changed = !!edit?.pair && !samePair(edit.pair, item);

  // Put back by "undo": it comes in from the side it left by.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enterFrom) return;
    el.style.transition = "none";
    el.style.transform = exitTransform(enterFrom, 0);
    el.style.opacity = "0";
    void el.offsetWidth;
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
    el.style.setProperty("--p", "0");
    delete el.dataset.dir;
    onEntered?.();
  }, [enterFrom, onEntered]);

  // Flies out the way it was decided.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !leaving) return;
    el.style.transition = "transform 0.42s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.42s ease";
    el.style.setProperty("--p", "1");
    if (leaving.exit !== "down") el.dataset.dir = leaving.exit;
    requestAnimationFrame(() => {
      el.style.transform = exitTransform(leaving.exit, leaving.dy);
      el.style.opacity = "0";
    });
  }, [leaving]);

  const interactive = depth === 0 && !leaving;
  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || (e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, time: performance.now(), dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    ref.current!.dataset.dragging = "true";
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    d.dx = e.clientX - d.x;
    d.dy = e.clientY - d.y;
    el.style.transform = `translate(${d.dx}px, ${d.dy * 0.25}px) rotate(${d.dx / 18}deg)`;
    el.style.setProperty("--p", Math.min(1, Math.abs(d.dx) / SWIPE_PX).toFixed(2));
    el.dataset.dir = d.dx > 0 ? "yes" : "later";
  };
  const onPointerUp = () => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    el.dataset.dragging = "false";
    const speed = d.dx / Math.max(1, performance.now() - d.time);
    const dir: Dir | null = d.dx > SWIPE_PX || speed > FLICK_SPEED ? "yes" : d.dx < -SWIPE_PX || speed < -FLICK_SPEED ? "later" : null;
    if (dir && Math.abs(d.dx) > 8) {
      onSwipe?.(dir, d.dy * 0.25);
      return;
    }
    // Short of the threshold: back to the stack with a bounce.
    el.style.transform = "";
    el.style.setProperty("--p", "0");
    delete el.dataset.dir;
  };

  const guessLabel = item.subscription ? t("review.guess.linked") : item.review_reason === "transfer" && !changed ? t("review.guess.transfer") : t("review.guess.label");
  const isTransfer = item.review_reason === "transfer" && !changed;
  // After choosing another category, the one it had becomes a chip to go back to.
  const original = { category_id: item.category_id, subcategory_id: item.subcategory_id };
  const alternatives = [...(changed && original.category_id ? [original] : []), ...item.alternatives].filter(
    (alt, i, list) => !samePair(alt, pair) && list.findIndex((other) => samePair(other, alt)) === i
  );
  const more: { key: string; icon: React.ReactNode; label: string; onClick?: () => void }[] = [];
  if (isTransfer) more.push({ key: "counted", icon: <Check />, label: t(item.type === "income" ? "review.more.isIncome" : "review.more.isExpense"), onClick: onCounted });
  else {
    if (item.type === "expense" && hasGroups && item.hint !== "subcount") more.push({ key: "share", icon: <Split />, label: t("review.more.subcount"), onClick: onShare });
    if (item.type === "expense" && !item.subscription) more.push({ key: "sub", icon: <Repeat />, label: t("review.more.subscription"), onClick: onSubscription });
    if (!item.subscription) more.push({ key: "not", icon: <ArrowLeftRight />, label: t(item.type === "income" ? "review.more.notIncome" : "review.more.notExpense"), onClick: onNotCounted });
  }

  return (
    <article
      ref={ref}
      className="rv-card"
      data-depth={leaving ? 0 : Math.min(depth, 3)}
      data-kind={kindKey}
      data-leaving={leaving ? "" : undefined}
      style={{ zIndex: leaving ? 20 : 10 - depth }}
      aria-hidden={depth > 0 || !!leaving}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="rv-stamp rv-stamp--yes">{t("review.confirm")}</span>
      <span className="rv-stamp rv-stamp--later">{t("review.later")}</span>
      <header className="rv-card-top">
        <span className="rv-acct">
          {item.account && <span className="lp-dot" style={{ background: item.account.color ?? "var(--gris-claro)" }} />}
          <span className="rv-acct-text">
            {item.account?.name ? `${item.account.name} · ` : ""}
            {whenLabel(item.date, lang)}
          </span>
        </span>
        <span className="rv-kind">
          <kind.icon />
          {t(kind.key)}
        </span>
      </header>

      <div className="rv-who">
        <span className="rv-tile">
          {item.subscription?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote service logos
            <img src={item.subscription.icon} alt="" />
          ) : isTransfer ? (
            <ArrowLeftRight />
          ) : labels.pairEmoji(pair) ? (
            labels.pairEmoji(pair)
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- generated initials
            <img src={initialsAvatarDataUri(name)} alt="" />
          )}
        </span>
        <h3 className="rv-name">{name}</h3>
        {raw && raw.toLowerCase() !== name.toLowerCase() && <p className="rv-raw">{raw}</p>}
      </div>

      <p className={cn("rv-amount", item.type === "income" && "is-income")}>
        <CardAmount value={item.amount} income={item.type === "income"} />
      </p>

      <div className="rv-guess-block">
        <span className="rv-label">{guessLabel}</span>
        <button type="button" className="rv-guess" key={pop} data-pop={pop > 0 ? "" : undefined} onClick={onPickCategory} disabled={!interactive}>
          {isTransfer ? (
            <>
              <ArrowLeftRight className="rv-guess-icon" />
              <span>{t("review.guess.transferName")}</span>
            </>
          ) : pair.category_id ? (
            <>
              {labels.pairEmoji(pair) && <span className="rv-guess-emoji">{labels.pairEmoji(pair)}</span>}
              <span>{labels.pairLabel(pair)}</span>
            </>
          ) : (
            <span>{t("review.guess.pick")}</span>
          )}
          <ChevronDown />
        </button>
        {changed ? (
          <div className="rv-learn" data-off={edit?.learn ? undefined : ""}>
            <span className="rv-learn-text">
              {edit?.learn && <Check />}
              {edit?.learn ? interpolate(t("review.learn"), { name }) : t("review.learnOff")}
            </span>
            <button type="button" className="rv-learn-toggle" onClick={onToggleLearn} disabled={!interactive}>
              {edit?.learn ? t("review.learnOnly") : t("review.learnOn")}
            </button>
          </div>
        ) : (
          <p className="rv-why">{whyText(item, t, labels, name)}</p>
        )}
        {alternatives.length > 0 && !isTransfer && (
          <div className="rv-alts">
            {alternatives.map((alt) => (
              <button key={`${alt.category_id}/${alt.subcategory_id}`} type="button" className="sf-chip" disabled={!interactive} onClick={() => onAlternative?.(alt)}>
                {labels.pairEmoji(alt) && <span className="sf-chip-emoji">{labels.pairEmoji(alt)}</span>}
                <span className="sf-chip-label">{labels.pairLabel(alt)}</span>
              </button>
            ))}
            <button type="button" className="sf-chip" disabled={!interactive} onClick={onPickCategory}>
              <span className="sf-chip-label">{t("review.other")}</span>
            </button>
          </div>
        )}
      </div>

      {item.hint && (
        <button type="button" className="rv-hint" disabled={!interactive} onClick={item.hint === "settle" ? onSettle : onShare}>
          <span className="rv-hint-icon">{item.hint === "settle" ? <HandCoins /> : <Users />}</span>
          <span className="rv-hint-text">
            <b>{t(item.hint === "settle" ? "review.hint.settle.title" : "review.hint.subcount.title")}</b>
            {t(item.hint === "settle" ? "review.hint.settle.text" : "review.hint.subcount.text")}
          </span>
          <ChevronRight />
        </button>
      )}

      {more.length > 0 && (
        <footer className="rv-more">
          {more.map((m) => (
            <button key={m.key} type="button" className="rv-more-btn" disabled={!interactive} onClick={m.onClick}>
              {m.icon}
              {m.label}
            </button>
          ))}
        </footer>
      )}
    </article>
  );
}

function exitTransform(exit: Exit, dy: number) {
  if (exit === "down") return "translateY(110%) scale(0.9)";
  const x = exit === "later" ? -1 : 1;
  return `translate(${x * 140}%, ${dy - 30}px) rotate(${x * 22}deg)`;
}

function CardAmount({ value, income }: { value: number; income: boolean }) {
  const text = formatCurrency(value);
  const comma = text.lastIndexOf(",");
  return (
    <>
      {income ? "+" : "−"}
      {comma < 0 ? text : text.slice(0, comma)}
      {comma >= 0 && <small>{text.slice(comma)}</small>}
    </>
  );
}

/** "Today, 09:12" / "Mon 16, 21:30". */
function whenLabel(iso: string, lang: string) {
  const date = new Date(iso);
  const locale = lang === "es" ? "es-ES" : "en-GB";
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const label =
    day(date) === day(today)
      ? lang === "es" ? "Hoy" : "Today"
      : day(date) === day(yesterday)
        ? lang === "es" ? "Ayer" : "Yesterday"
        : date.toLocaleDateString(locale, { weekday: "short", day: "numeric", timeZone: "Europe/Madrid" }).replace(".", "");
  const capital = label.charAt(0).toUpperCase() + label.slice(1);
  // A bank day without time comes at midnight: just the day.
  return time === "00:00" || time === "01:00" || time === "02:00" ? capital : `${capital}, ${time}`;
}

function whyText(item: ReviewItem, t: (key: UIKey) => string, labels: CardLabels, name: string) {
  const why = item.why;
  switch (why.kind) {
    case "rule":
      return interpolate(t("review.why.rule"), { pattern: why.pattern });
    case "same":
      return interpolate(t("review.why.same"), { count: String(why.count), name });
    case "split":
      return interpolate(t("review.why.split"), {
        name,
        list: why.counts.map((c) => interpolate(t("review.why.splitPart"), { count: String(c.count), category: labels.pairLabel(c.pair) })).join(", "),
      });
    case "once":
      return interpolate(t("review.why.once"), { name });
    case "new":
      return t(why.guessed ? "review.why.new" : "review.why.newEmpty");
    case "transfer":
      return t("review.why.transfer");
    case "settle":
      return why.minutes < 90
        ? interpolate(t("review.why.settleMin"), { minutes: String(Math.max(1, why.minutes)), merchant: merchantName(why.merchant) })
        : interpolate(t("review.why.settleHours"), { hours: String(Math.round(why.minutes / 60)), merchant: merchantName(why.merchant) });
    case "linked":
      return interpolate(t("review.why.linked"), { name: item.subscription?.service_name ?? name });
  }
}

/** The end: the gem builds itself facet by facet and sums up what was decided. */
function DoneView({ deck, onClose }: { deck: DeckState; onClose: () => void }) {
  const t = useTranslations(useLang());
  const results = Object.values(deck.results);
  const yes = results.filter((r) => r === "yes").length;
  const later = results.filter((r) => r === "later").length;
  const empty = deck.total.length === 0;
  const rows: { icon: "check" | "clock"; text: string }[] = empty
    ? []
    : [
        { icon: "check", text: yes === 1 ? t("review.done.confirmedOne") : interpolate(t("review.done.confirmed"), { n: String(yes) }) },
        ...Object.values(deck.learned).map((rule) => ({ icon: "check" as const, text: interpolate(t("review.done.learned"), { rule }) })),
        ...(later > 0 ? [{ icon: "clock" as const, text: interpolate(t(later === 1 ? "review.done.laterOne" : "review.done.later"), { n: String(later) }) }] : []),
      ];
  const facets: [string, string][] = [
    ["20,12 26,25 8,25", "var(--accent-light)"],
    ["20,12 32,12 26,25", "var(--accent)"],
    ["32,12 38,25 26,25", "var(--success)"],
    ["32,12 44,12 38,25", "var(--accent-light)"],
    ["44,12 56,25 38,25", "var(--accent)"],
    ["8,25 26,25 32,55", "color-mix(in srgb, var(--accent) 55%, #000)"],
    ["26,25 38,25 32,55", "var(--accent)"],
    ["38,25 56,25 32,55", "var(--accent-light)"],
  ];
  return (
    <div className="rv-done">
      <svg className="rv-gem" viewBox="6 10 52 47" aria-hidden>
        <g style={{ stroke: "var(--negro)" }} strokeWidth={1.4} strokeLinejoin="round">
          {facets.map(([points, fill], i) => (
            <polygon key={points} points={points} style={{ fill, "--f": i } as React.CSSProperties} />
          ))}
        </g>
      </svg>
      <h2>{t(empty ? "review.empty.title" : "review.done.title")}</h2>
      <p>{t(empty ? "review.empty.text" : "review.done.text")}</p>
      {rows.length > 0 && (
        <div className="rv-done-list">
          {rows.map((row, i) => (
            <div key={i} className="rv-done-row" style={{ "--i": i } as React.CSSProperties}>
              {row.icon === "clock" ? <Clock /> : <Check />}
              <span>{row.text}</span>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="rv-done-btn" onClick={onClose}>
        {t("review.done.back")}
      </button>
    </div>
  );
}
