"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Trash2, Wallet } from "lucide-react";
import { ColorPicker, PALETTE } from "@/components/ColorPicker";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PageHeader } from "@/components/PageHeader";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SortableContainer, SortableItem } from "@/components/Sortable";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { AddButton } from "@/components/ui/add-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput, parseCurrencyValue } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { SubmitButton } from "@/components/ui/submit-button";
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget, type BudgetWithSpent } from "@/hooks/useBudgets";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReorder } from "@/hooks/useReorder";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

type Lookup = ReturnType<typeof useCategoryLookup>;

/** Top-level categories linked to a budget. */
const rootIds = (budget: BudgetWithSpent, categories: Lookup) => [...new Set(budget.categoryIds.map((id) => categories.parent.get(id) ?? id))];

/** Budget card; `compact` (drag overlay) only shows spent / limit, `actions` go next to the title. */
function BudgetCard({ budget, categories, compact, actions }: {
  budget: BudgetWithSpent;
  categories: Lookup;
  compact?: boolean;
  actions?: React.ReactNode;
}) {
  const t = useTranslations(useLang());
  const amount = Number(budget.amount);
  const spent = Number(budget.spent ?? 0);
  const over = spent > amount;
  const pct = amount > 0 ? (spent / amount) * 100 : 0;
  const warning = pct >= 80 && !over;
  const roots = rootIds(budget, categories);
  const emoji = roots.length ? categories.emoji.get(roots[0]) : undefined;
  const money = (n: number) => <SensitiveAmount>{formatCurrency(n)}</SensitiveAmount>;

  return (
    <div
      className={cn("budget-card", compact && "sortable-overlay", over && "budget-card--over")}
      style={{ "--accent-budget": budget.color || "var(--accent)" } as React.CSSProperties}
    >
      <div className="budget-card-badges-row">
        <span className="budget-card-icon-blur" aria-hidden>
          {emoji ? <span className="budget-card-emoji">{emoji}</span> : <Wallet size={20} strokeWidth={1.5} />}
        </span>
        {roots.length ? (
          <span className="budget-card-title-categories">{roots.map((id) => categories.name.get(id)).filter(Boolean).join(", ")}</span>
        ) : (
          <span className="budget-card-title-categories budget-card-title-categories--general">{t("budgets.generalBudget")}</span>
        )}
        {actions}
      </div>
      <p className="budget-card-summary">
        {money(spent)}
        {" / "}
        {money(amount)}
        {!compact && (
          <>
            {" → "}
            {money(over ? spent - amount : amount - spent)}
            {over && (
              <>
                {" · "}
                <span className="budget-card-summary-exceeded">
                  <AlertTriangle size={14} className="budget-card-exceeded-icon" aria-hidden />
                  {t("budgets.exceeded")}
                </span>
              </>
            )}
          </>
        )}
      </p>
      {!compact && (
        <div className={cn("budget-card-progress-wrap", over && "budget-progress-over", warning && "budget-progress-warning")}>
          <Progress value={amount > 0 ? Math.min(100, pct) : 0} className="h-2 budget-card-progress" />
          <span className={cn("budget-card-pct", over && "budget-card-pct--over", warning && "budget-card-pct--warning")}>{Math.round(pct)}%</span>
        </div>
      )}
    </div>
  );
}

/** Create (no `budget`) or edit budget dialog body. */
function BudgetForm({ budget, categories, onClose }: { budget?: BudgetWithSpent; categories: Lookup; onClose: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: categoriesData } = useCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const [amount, setAmount] = useState(budget ? Number(budget.amount).toFixed(2).replace(".", ",") : "");
  const [color, setColor] = useState<string>(budget?.color && PALETTE.some((c) => c === budget.color) ? budget.color : PALETTE[0]);
  const [categoryIds, setCategoryIds] = useState(budget ? rootIds(budget, categories) : []);
  const roots = [...(categoriesData?.userCategories ?? []), ...(categoriesData?.defaultCategories ?? [])];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseCurrencyValue(amount);
    if (value < 0) return;
    try {
      if (budget) await updateBudget.mutateAsync({ id: budget.id, amount: value, color, category_ids: categoryIds });
      else await createBudget.mutateAsync({ amount: value, color, category_ids: categoryIds.length > 0 ? categoryIds : undefined });
      onClose();
    } catch {
      // The mutation rolls back its optimistic update.
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">{t(budget ? "budgets.edit" : "budgets.add")}</DialogTitle>
        <DialogDescription className="text-center">{lang === "es" ? "Configura un límite mensual de gastos" : "Set a monthly spending limit"}</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label className="subs-form-label" htmlFor="budget-amount" required>
            {t("budgets.monthlyLimit")}
          </Label>
          <CurrencyInput id="budget-amount" placeholder="0,00" value={amount} onChange={setAmount} className="h-10" />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="subs-form-label">{t("common.color")}</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="subs-form-label" optional>
            {t("budgets.linkedCategories")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("budgets.generalBudget")} {lang === "es" ? "si no eliges ninguna" : "if you leave none selected"}
          </p>
          <div className="flex flex-col gap-1 min-w-0 max-h-48 overflow-y-auto">
            {roots.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 cursor-pointer py-1 min-w-0">
                <Checkbox
                  checked={categoryIds.includes(cat.id)}
                  onCheckedChange={() =>
                    setCategoryIds((ids) => (ids.includes(cat.id) ? ids.filter((id) => id !== cat.id) : [...ids, cat.id]))
                  }
                />
                {cat.emoji && <span className="text-base shrink-0">{cat.emoji}</span>}
                <span className="text-sm truncate">{categories.name.get(cat.id)}</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter className="sm:justify-center gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <SubmitButton pending={createBudget.isPending || updateBudget.isPending} isEdit={!!budget} className="gap-2">
            {budget ? t("common.save") : lang === "es" ? "Crear" : "Create"}
          </SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

export default function BudgetsBody() {
  const t = useTranslations(useLang());
  const { data: budgets = [], isLoading } = useBudgets();
  const categories = useCategoryLookup();
  const deleteBudget = useDeleteBudget();
  const { handleReorder } = useReorder<BudgetWithSpent>({ table: "budgets" });
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [createOpen, setCreateOpen] = useCreateDialog();
  const [editing, setEditing] = useState<BudgetWithSpent | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const formOpen = createOpen || !!editing;
  const closeForm = () => {
    setCreateOpen(false);
    setEditing(null);
  };

  const header = (
    <PageHeader icon={<Wallet size={26} strokeWidth={1.5} />} title={t("budgets.title")} subtitle={t("budgets.heroSubtitle")}>
      {!isLoading && <AddButton onClick={() => setCreateOpen(true)}>{t("budgets.add")}</AddButton>}
    </PageHeader>
  );

  if (isLoading) {
    return (
      <div className="page-container">
        {header}
        <div className="budgets-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  const stop = (action: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };
  const sortable = (mobile: boolean) => (
    <SortableContainer
      items={budgets}
      onReorder={handleReorder}
      className={`budgets-grid budgets-grid--${mobile ? "mobile" : "desktop"}`}
      strategy={mobile ? "vertical" : "grid"}
      renderOverlay={(active) => active && <BudgetCard budget={active} categories={categories} compact />}
      renderItem={(budget) =>
        mobile ? (
          <SortableItem key={budget.id} id={budget.id} showHandle={false}>
            <SwipeToReveal
              id={budget.id}
              className="budget-swipe-wrapper"
              swipeHint
              desktopMinWidth={768}
              actions={
                <div className="budget-swipe-actions">
                  <button type="button" onClick={stop(() => setEditing(budget))} className="budget-swipe-btn budget-swipe-btn--edit" aria-label={t("common.edit")}>
                    <Pencil className="size-5" />
                  </button>
                  <button type="button" onClick={stop(() => setToDelete(budget.id))} className="budget-swipe-btn budget-swipe-btn--delete" aria-label={t("common.delete")}>
                    <Trash2 className="size-5" />
                  </button>
                </div>
              }
            >
              <BudgetCard budget={budget} categories={categories} />
            </SwipeToReveal>
          </SortableItem>
        ) : (
          <SortableItem key={budget.id} id={budget.id}>
            <BudgetCard
              budget={budget}
              categories={categories}
              actions={
                <div className="budget-card-actions">
                  <button type="button" className="budget-card-action-btn budget-card-action-btn--edit" onClick={stop(() => setEditing(budget))} aria-label={t("common.edit")}>
                    <Pencil size={18} />
                  </button>
                  <button type="button" className="budget-card-action-btn budget-card-action-btn--delete" onClick={stop(() => setToDelete(budget.id))} aria-label={t("common.delete")}>
                    <Trash2 size={18} />
                  </button>
                </div>
              }
            />
          </SortableItem>
        )
      }
    />
  );

  return (
    <div className="page-container fade-in">
      {header}

      <div className="budgets-grid">
        {budgets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Wallet size={48} strokeWidth={1.5} />
            </div>
            <p>{t("budgets.noBudgets")}</p>
            <p style={{ fontSize: "0.9rem", color: "var(--gris-claro)", marginTop: "0.25rem" }}>{t("budgets.noBudgetsText")}</p>
          </div>
        ) : isMobile ? (
          <SwipeToRevealGroup className="budgets-grid budgets-grid--swipe">{sortable(true)}</SwipeToRevealGroup>
        ) : (
          sortable(false)
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="sm:max-w-md max-h-[calc(100dvh-11rem)] md:max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain pb-4 !top-[calc(50%-40px)] md:!top-[50%] !bg-[var(--negro)] !border-[var(--gris)]">
          {formOpen && <BudgetForm key={editing?.id ?? "new"} budget={editing ?? undefined} categories={categories} onClose={closeForm} />}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("budgets.deleteTitle")}
        description={t("budgets.deleteConfirm")}
        pending={deleteBudget.isPending}
        onConfirm={async () => {
          if (toDelete) await deleteBudget.mutateAsync(toDelete).catch(() => undefined);
          setToDelete(null);
        }}
      />
    </div>
  );
}
