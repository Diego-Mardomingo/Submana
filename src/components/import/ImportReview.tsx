"use client";

import { useMemo, useState } from "react";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Button } from "@/components/ui/button";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { formatCurrency, localeOf } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import type { ImportedTransaction, ImportPreviewRow, ImportResolution, ImportRowMatch } from "@/lib/parsers/types";

/** One account's worth of statement rows plus the server's classification of each. */
export interface ReviewGroup {
  id: "main" | "deposit";
  title: string;
  note?: string;
  transactions: ImportedTransaction[];
  rows: ImportPreviewRow[];
}

export type ReviewResolutions = Record<ReviewGroup["id"], ImportResolution[]>;

type Tab = "new" | "merge" | "review" | "imported" | "skipped";
type Choice = "merge" | "insert" | "skip";

interface Item {
  key: string;
  groupId: ReviewGroup["id"];
  groupTitle: string;
  tx: ImportedTransaction;
  status: ImportPreviewRow["status"];
  match?: ImportRowMatch;
}

const TABS: { id: Tab; labelKey: "import.review.tab.new" | "import.review.tab.merge" | "import.review.tab.review" | "import.review.tab.imported" | "import.review.tab.skipped" }[] = [
  { id: "new", labelKey: "import.review.tab.new" },
  { id: "merge", labelKey: "import.review.tab.merge" },
  { id: "review", labelKey: "import.review.tab.review" },
  { id: "imported", labelKey: "import.review.tab.imported" },
  { id: "skipped", labelKey: "import.review.tab.skipped" },
];

const TAB_OF_STATUS = { new: "new", sure: "merge", possible: "review", already_imported: "imported", skipped: "skipped" } as const;
/** Rows rendered per tab before "show more": a statement can have thousands of lines. */
const PAGE = 50;

function formatStatementDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const hasTime = /T\d{2}:\d{2}/.test(dateStr) || (dateStr.length > 10 && /\d{2}:\d{2}/.test(dateStr));
  return hasTime ? d.toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "medium" }) : d.toLocaleDateString(localeOf(lang));
}

const defaultChoice = (item: Item): Choice => (item.status === "sure" ? "merge" : "insert");

/** Review of an import before anything is written: new lines, merges into manual transactions and doubtful matches. */
export default function ImportReview({ groups, onCancel, onImport }: {
  groups: ReviewGroup[];
  onCancel: () => void;
  onImport: (resolutions: ReviewResolutions) => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const categoryNames = useCategoryLookup().name;
  const [tab, setTab] = useState<Tab>("new");
  const [choices, setChoices] = useState<Map<string, Choice>>(new Map());
  const [shown, setShown] = useState<Record<Tab, number>>({ new: PAGE, merge: PAGE, review: PAGE, imported: PAGE, skipped: PAGE });

  const byTab = useMemo(() => {
    const result: Record<Tab, Item[]> = { new: [], merge: [], review: [], imported: [], skipped: [] };
    for (const group of groups) {
      const txByFingerprint = new Map<string, ImportedTransaction>();
      for (const tx of group.transactions) if (tx.import_source_fingerprint && !txByFingerprint.has(tx.import_source_fingerprint)) txByFingerprint.set(tx.import_source_fingerprint, tx);
      for (const row of group.rows) {
        const tx = txByFingerprint.get(row.fingerprint);
        if (!tx) continue;
        result[TAB_OF_STATUS[row.status]].push({ key: `${group.id}:${row.fingerprint}`, groupId: group.id, groupTitle: group.title, tx, status: row.status, match: row.match });
      }
    }
    return result;
  }, [groups]);

  const choiceOf = (item: Item): Choice => choices.get(item.key) ?? defaultChoice(item);
  const setMany = (items: Item[], choice: Choice) =>
    setChoices((prev) => {
      const next = new Map(prev);
      for (const item of items) next.set(item.key, choice);
      return next;
    });

  const decidable = useMemo(() => [...byTab.merge, ...byTab.review], [byTab]);
  const counts = useMemo(() => {
    let inserted = byTab.new.length;
    let merged = 0;
    let skipped = byTab.imported.length + byTab.skipped.length;
    for (const item of decidable) {
      const choice = choices.get(item.key) ?? defaultChoice(item);
      if (choice === "merge") merged++;
      else if (choice === "skip") skipped++;
      else inserted++;
    }
    return { inserted, merged, skipped };
  }, [byTab, decidable, choices]);

  const handleImport = () => {
    const resolutions: ReviewResolutions = { main: [], deposit: [] };
    for (const item of decidable) {
      const action = choiceOf(item);
      resolutions[item.groupId].push({
        fingerprint: item.tx.import_source_fingerprint,
        action,
        ...(action === "merge" && item.match && { target_id: item.match.id }),
      });
    }
    onImport(resolutions);
  };

  const amount = (value: number, type: "income" | "expense") => (
    <span className={`bank-statement-preview-amount ${type}`}>
      {type === "income" ? "+" : "-"}
      <SensitiveAmount>{formatCurrency(value)}</SensitiveAmount>
    </span>
  );

  /** "+3 days · description matches" */
  const hint = (match: ImportRowMatch) => {
    const days =
      match.deltaDays === 0
        ? t("import.review.sameDay")
        : `${match.deltaDays > 0 ? "+" : ""}${match.deltaDays} ${t(Math.abs(match.deltaDays) === 1 ? "import.review.day" : "import.review.days")}`;
    const desc =
      match.descScore === null
        ? null
        : t(match.descScore >= 0.8 ? "import.review.descMatches" : match.descScore > 0 ? "import.review.descPartial" : "import.review.descDiffers");
    return [days, desc].filter(Boolean).join(" · ");
  };

  const compactRow = (item: Item, extra?: React.ReactNode) => (
    <div key={item.key} className={`bank-statement-preview-item ${item.tx.type}`}>
      <div className="bank-statement-preview-item-left">
        <span className="bank-statement-preview-date">
          {formatStatementDate(item.tx.date, lang)}
          {groups.length > 1 && ` · ${item.groupTitle}`}
        </span>
        <span className="bank-statement-preview-desc">{item.tx.description}</span>
        {extra}
      </div>
      {amount(item.tx.amount, item.tx.type)}
    </div>
  );

  const choiceButtons = (item: Item, options: Choice[]) => {
    const labels: Record<Choice, string> = { merge: t("import.review.merge"), insert: t("import.review.keepBoth"), skip: t("import.review.skipLine") };
    return (
      <div className="duplicate-card-actions">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`duplicate-btn duplicate-btn-${option === "merge" ? "keep" : option === "skip" ? "undo" : "remove"} ${choiceOf(item) === option ? "active" : ""}`}
            onClick={() => setMany([item], option)}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    );
  };

  const renderItem = (item: Item) => {
    if (tab === "merge" && item.match) {
      const merging = choiceOf(item) === "merge";
      return compactRow(
        item,
        <>
          <span className="import-review-hint">
            {t("import.review.mergesInto")}: {item.match.description || "—"} · {formatStatementDate(item.match.date, lang)}
            {item.match.category_id && categoryNames.get(item.match.category_id) ? ` · ${categoryNames.get(item.match.category_id)}` : ""}
          </span>
          <span className="import-review-hint">{hint(item.match)}</span>
          <button type="button" className="duplicate-btn" style={{ alignSelf: "flex-start" }} onClick={() => setMany([item], merging ? "insert" : "merge")}>
            {merging ? t("import.review.undoMerge") : t("import.review.redoMerge")}
          </button>
        </>
      );
    }
    if (tab === "review" && item.match) {
      const { match } = item;
      return (
        <div key={item.key} className="duplicate-card">
          <div className="duplicate-card-meta">
            <span className="duplicate-card-account">{item.groupTitle}</span>
            <span className="duplicate-card-date">{hint(match)}</span>
          </div>
          <div className="duplicate-card-comparison">
            <div className="duplicate-card-side duplicate-card-existing">
              <div className="duplicate-card-label">{t("import.review.yourTx")}</div>
              <div className="duplicate-card-desc">{match.description || "—"}</div>
              <div className="duplicate-card-amount">
                <SensitiveAmount>{formatCurrency(match.amount)}</SensitiveAmount>
              </div>
              <div className="import-review-hint">{formatStatementDate(match.date, lang)}</div>
            </div>
            <div className="duplicate-card-divider" />
            <div className="duplicate-card-side duplicate-card-new">
              <div className="duplicate-card-label">{t("import.review.bankLine")}</div>
              <div className="duplicate-card-desc">{item.tx.description}</div>
              <div className="duplicate-card-amount">
                <SensitiveAmount>{formatCurrency(item.tx.amount)}</SensitiveAmount>
              </div>
              <div className="import-review-hint">{formatStatementDate(item.tx.date, lang)}</div>
            </div>
          </div>
          {choiceButtons(item, ["merge", "insert", "skip"])}
        </div>
      );
    }
    return compactRow(item);
  };

  const items = byTab[tab];
  const bulk: { choice: Choice; label: string }[] =
    tab === "merge"
      ? [
          { choice: "merge", label: t("import.review.mergeAll") },
          { choice: "insert", label: t("import.review.undoMerge") },
        ]
      : tab === "review"
        ? [
            { choice: "merge", label: t("import.review.mergeAll") },
            { choice: "insert", label: t("import.review.keepBothAll") },
            { choice: "skip", label: t("import.review.skipAll") },
          ]
        : [];

  return (
    <div className="import-review">
      <div className="bank-statement-preview-actions">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {t("common.cancel")}
        </Button>
        <Button onClick={handleImport} disabled={counts.inserted + counts.merged === 0}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t("import.import")} ({counts.inserted + counts.merged})
        </Button>
      </div>
      <p className="import-review-summary">
        {interpolate(t("import.review.summary"), { n: counts.inserted, m: counts.merged, k: counts.skipped })}
      </p>
      {byTab.merge.length + byTab.review.length > 0 && <p className="import-review-intro">{t("import.review.intro")}</p>}

      <div className="import-review-tabs" role="tablist">
        {TABS.map(({ id, labelKey }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`import-review-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {t(labelKey)}
            <span className="import-review-tab-count">{byTab[id].length}</span>
          </button>
        ))}
      </div>

      {bulk.length > 0 && items.length > 0 && (
        <div className="import-review-bulk">
          <span className="duplicates-review-bulk-label">{t("import.review.bulkLabel")}</span>
          {bulk.map(({ choice, label }) => (
            <button key={choice} type="button" className="duplicate-btn" onClick={() => setMany(items, choice)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "skipped" && items.length > 0 && <p className="import-review-hint">{t("import.review.skippedNote")}</p>}

      <div className="import-review-list">
        {items.length === 0 && <p className="bank-statement-preview-more">{t("import.review.empty")}</p>}
        {items.slice(0, shown[tab]).map(renderItem)}
        {items.length > shown[tab] && (
          <Button variant="outline" size="sm" className="import-review-more" onClick={() => setShown((prev) => ({ ...prev, [tab]: prev[tab] + PAGE }))}>
            {interpolate(t("import.review.showMore"), { n: items.length - shown[tab] })}
          </Button>
        )}
      </div>
    </div>
  );
}
