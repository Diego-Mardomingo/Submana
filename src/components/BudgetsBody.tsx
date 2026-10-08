"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Bones } from "@/components/Bones";
import { BudgetSheet } from "@/components/BudgetSheet";
import { CompactPageHeader } from "@/components/PageHeader";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SortableContainer, SortableItem } from "@/components/Sortable";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { rootIds, useBudgets, useUndoableDeleteBudget, type BudgetWithSpent } from "@/hooks/useBudgets";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useReorder } from "@/hooks/useReorder";
import { appNow } from "@/lib/date";
import { formatCurrency, monthName } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

type Lookup = ReturnType<typeof useCategoryLookup>;

/** Progress colour: red once exceeded, amber from 80%, otherwise `base`. */
const statusColor = (pct: number, base: string) => (pct > 100 ? "var(--danger)" : pct >= 80 ? "var(--warning)" : base);

const money = (n: number) => <SensitiveAmount>{formatCurrency(n)}</SensitiveAmount>;

/** Row body shared by the list, the drag overlay and the dashboard. */
export function BudgetRowContent({ budget, categories }: { budget: BudgetWithSpent; categories: Lookup }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const amount = Number(budget.amount);
  const spent = Number(budget.spent ?? 0);
  const pct = amount > 0 ? (spent / amount) * 100 : 0;
  const color = budget.color || "var(--accent)";
  const roots = rootIds(budget, categories);
  const emoji = roots.length ? categories.emoji.get(roots[0]) : undefined;
  const status = pct > 100 ? "is-negative" : pct >= 80 ? "is-warn" : undefined;

  return (
    <>
      <span className="lp-icon" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }} aria-hidden>
        {emoji ?? <Wallet size={19} strokeWidth={2} />}
      </span>
      <span className="lp-main">
        <span className="lp-title">
          <span>{roots.length ? roots.map((id) => categories.name.get(id)).filter(Boolean).join(", ") : t("budgets.generalBudget")}</span>
        </span>
        <span className="lp-meta">
          <span className="lp-progress" aria-hidden>
            <span style={{ width: `${Math.min(100, pct)}%`, background: statusColor(pct, color) }} />
          </span>
          <span className={cn("lp-pct", status)}>{Math.round(pct)}%</span>
        </span>
      </span>
      <span className="lp-end">
        <span className={cn("lp-amount", pct > 100 && "is-negative")}>{money(spent)}</span>
        <span className="lp-sub-amount">
          {lang === "es" ? "de" : "of"} {money(amount)}
        </span>
      </span>
    </>
  );
}

export default function BudgetsBody() {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const { data: budgets = [], isLoading } = useBudgets();
  const categories = useCategoryLookup();
  const deleteBudget = useUndoableDeleteBudget();
  const { handleReorder } = useReorder<BudgetWithSpent>({ table: "budgets" });
  const [createOpen, setCreateOpen] = useCreateDialog();
  const [editing, setEditing] = useState<BudgetWithSpent | null>(null);
  const formOpen = createOpen || !!editing;
  const closeForm = () => {
    setCreateOpen(false);
    setEditing(null);
  };

  const header = <CompactPageHeader title={t("budgets.title")} addLabel={t("budgets.add")} onAdd={() => setCreateOpen(true)} />;

  const dialogs = <BudgetSheet open={formOpen} onOpenChange={(open) => !open && closeForm()} budget={editing} />;

  if (isLoading) {
    return (
      <div className="page-container lp-page">
        {header}
        <Bones
          name="budgets"
          loading
          fallback={
            <div className="lp-layout">
              <div className="lp-aside">
                <div className="skeleton" style={{ height: 168, borderRadius: 16 }} />
              </div>
              <div className="lp-content">
                <div className="skeleton" style={{ height: 3 * 57, borderRadius: 16 }} />
              </div>
            </div>
          }
        />
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="page-container lp-page fade-in">
        {header}
        <div className="lp-card lp-empty">
          <div className="lp-empty-icon">
            <Wallet size={24} strokeWidth={2.5} />
          </div>
          <p className="lp-empty-title">{t("budgets.noBudgets")}</p>
          <p className="lp-empty-text">{t("budgets.noBudgetsText")}</p>
          <button type="button" className="lp-chip" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" strokeWidth={2.5} />
            {t("budgets.add")}
          </button>
        </div>
        {dialogs}
      </div>
    );
  }

  // A general budget already covers every expense, so adding the category budgets on top would count spending twice.
  const general = budgets.find((b) => b.categoryIds.length === 0);
  const scope = general ? [general] : budgets;
  const limit = scope.reduce((sum, b) => sum + Number(b.amount), 0);
  const spent = scope.reduce((sum, b) => sum + Number(b.spent ?? 0), 0);
  const remaining = limit - spent;
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const overCount = budgets.filter((b) => Number(b.spent ?? 0) > Number(b.amount)).length;
  const now = appNow();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;

  const stop = (action: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };
  const stat = (label: string, value: React.ReactNode, className?: string) => (
    <div className="lp-stat">
      <span className="lp-label">{label}</span>
      <span className={cn("lp-stat-value", className)}>{value}</span>
    </div>
  );

  return (
    <div className="page-container lp-page fade-in">
      {header}

      <Bones name="budgets" loading={false}>
        <div className="lp-layout">
          <aside className="lp-aside">
            <div className="lp-card lp-summary">
              <div className="lp-summary-top">
                <span className="lp-label">
                  {es ? "Disponible" : "Left to spend"} · {monthName(now.getMonth() + 1, lang, "long")}
                </span>
                <span className="lp-count">
                  {budgets.length} {es ? (budgets.length === 1 ? "presupuesto" : "presupuestos") : budgets.length === 1 ? "budget" : "budgets"}
                </span>
              </div>
              <span className={cn("lp-hero-value", remaining < 0 && "is-negative")}>{money(remaining)}</span>
              <div className="lp-meter-row">
                <div className="lp-meter" aria-hidden>
                  <span style={{ width: `${Math.min(100, pct)}%`, background: statusColor(pct, "var(--accent)") }} />
                </div>
                <span>
                  {money(spent)} {es ? "de" : "of"} {money(limit)}
                </span>
              </div>
              <div className="lp-summary-divider" />
              <div className="lp-stats">
                {stat(es ? "Al día" : "Per day", money(Math.max(0, remaining) / daysLeft))}
                {stat(es ? "Quedan" : "Days left", `${daysLeft} ${es ? (daysLeft === 1 ? "día" : "días") : daysLeft === 1 ? "day" : "days"}`)}
                {stat(es ? "Superados" : "Exceeded", overCount, overCount > 0 ? "is-negative" : "is-muted")}
              </div>
            </div>
          </aside>

          <div className="lp-content">
            <section className="lp-section">
              <div className="lp-section-head">
                <span className="lp-section-title">{es ? "Límites mensuales" : "Monthly limits"}</span>
                <span className="lp-section-aside">{es ? "Gastado" : "Spent"}</span>
              </div>
              <SwipeToRevealGroup>
                <SortableContainer
                  items={budgets}
                  onReorder={handleReorder}
                  className="lp-card lp-group lp-group--sortable"
                  strategy="vertical"
                  renderOverlay={(active) =>
                    active && (
                      <div className="lp-card lp-drag-overlay">
                        <div className="lp-row">
                          <BudgetRowContent budget={active} categories={categories} />
                        </div>
                      </div>
                    )
                  }
                  renderItem={(budget) => (
                    <SortableItem key={budget.id} id={budget.id}>
                      <SwipeToReveal
                        id={budget.id}
                        className="lp-swipe"
                        desktopMinWidth={1024}
                        actions={
                          <>
                            <button type="button" onClick={stop(() => setEditing(budget))} className="lp-action lp-action--edit" aria-label={t("common.edit")}>
                              <Pencil className="size-5" />
                            </button>
                            <button type="button" onClick={stop(() => deleteBudget(budget))} className="lp-action lp-action--danger" aria-label={t("common.delete")}>
                              <Trash2 className="size-5" />
                            </button>
                          </>
                        }
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className="lp-row"
                          onClick={() => setEditing(budget)}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                            e.preventDefault();
                            setEditing(budget);
                          }}
                        >
                          <BudgetRowContent budget={budget} categories={categories} />
                        </div>
                      </SwipeToReveal>
                    </SortableItem>
                  )}
                />
              </SwipeToRevealGroup>
            </section>
          </div>
        </div>
      </Bones>

      {dialogs}
    </div>
  );
}
