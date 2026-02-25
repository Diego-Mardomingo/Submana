"use client";

import { useState, useEffect, useMemo } from "react";
import { useBudgets, type BudgetWithSpent } from "@/hooks/useBudgets";
import {
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from "@/hooks/useBudgetMutations";
import { useCategories, type CategoryWithSubs, type CategoryItem } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Wallet, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { ACCOUNT_BUDGET_COLORS, defaultAccountBudgetColor } from "@/lib/accountBudgetColors";

const colors = ACCOUNT_BUDGET_COLORS;
const defaultBudgetColor = defaultAccountBudgetColor;

const formatCurrency = (n: number) => {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n) + " €";
};

export interface CategoryOption {
  id: string;
  label: string;
  isSub: boolean;
  parentId: string | null;
  subIds: string[]; // for parents: ids of all subcategories; for subs: []
}

function flattenCategoriesForSelect(
  defaultCats: CategoryWithSubs[],
  userCats: CategoryWithSubs[],
  lang: string
): CategoryOption[] {
  const out: CategoryOption[] = [];
  const add = (cat: CategoryWithSubs | CategoryItem, isSub: boolean, parentId: string | null, subIds: string[]) => {
    const name = (cat as CategoryWithSubs).name_en && lang === "en"
      ? (cat as CategoryWithSubs).name_en!
      : cat.name;
    out.push({ id: cat.id, label: name, isSub, parentId, subIds });
  };
  const walk = (list: CategoryWithSubs[]) => {
    for (const parent of list) {
      const subIds = (parent.subcategories ?? []).map((s) => s.id);
      add(parent, false, null, subIds);
      for (const sub of parent.subcategories ?? []) {
        add(sub, true, parent.id, []);
      }
    }
  };
  walk(defaultCats);
  walk(userCats);
  return out;
}

export default function BudgetsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: categoriesData } = useCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const isMobile = useMediaQuery("(max-width: 767px)");
  const defaultCategories = categoriesData?.defaultCategories ?? [];
  const userCategories = categoriesData?.userCategories ?? [];
  const categoryOptions = useMemo(
    () => flattenCategoriesForSelect(defaultCategories, userCategories, lang),
    [defaultCategories, userCategories, lang]
  );

  const categoryIdToName = useMemo(() => {
    const m = new Map<string, string>();
    categoryOptions.forEach((o) => m.set(o.id, o.label));
    return m;
  }, [categoryOptions]);

  const categoryIdToEmoji = useMemo(() => {
    const m = new Map<string, string>();
    const walk = (list: CategoryWithSubs[]) => {
      for (const parent of list) {
        if (parent.emoji) m.set(parent.id, parent.emoji);
        for (const sub of parent.subcategories ?? []) {
          if (sub.emoji) m.set(sub.id, sub.emoji);
        }
      }
    };
    walk(defaultCategories);
    walk(userCategories);
    return m;
  }, [defaultCategories, userCategories]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentBudget, setCurrentBudget] = useState<BudgetWithSpent | null>(null);
  type BudgetColor = (typeof ACCOUNT_BUDGET_COLORS)[number];
  const [formData, setFormData] = useState<{
    id: string;
    amount: string;
    color: BudgetColor;
    categoryIds: string[];
  }>({
    id: "",
    amount: "",
    color: defaultBudgetColor,
    categoryIds: [],
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const resetForm = () => {
    setFormData({
      id: "",
      amount: "",
      color: defaultBudgetColor,
      categoryIds: [],
    });
    setModalMode("create");
    setCurrentBudget(null);
  };

  const openModal = (mode: "create" | "edit", budget?: BudgetWithSpent) => {
    setIsModalOpen(true);
    setModalMode(mode);
    if (mode === "edit" && budget) {
      setFormData({
        id: budget.id,
        amount: String(budget.amount),
        color: (budget.color && ACCOUNT_BUDGET_COLORS.includes(budget.color as BudgetColor)
          ? budget.color
          : defaultBudgetColor) as BudgetColor,
        categoryIds: budget.categoryIds ?? [],
      });
      setCurrentBudget(budget);
    } else {
      resetForm();
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isModalOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount < 0) return;

    try {
      if (modalMode === "create") {
        await createBudget.mutateAsync({
          amount,
          color: formData.color || null,
          category_ids: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
        });
      } else if (formData.id) {
        await updateBudget.mutateAsync({
          id: formData.id,
          amount,
          color: formData.color || null,
          category_ids: formData.categoryIds,
        });
      }
      closeModal();
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!budgetToDelete) return;
    try {
      await deleteBudget.mutateAsync(budgetToDelete);
      setDeleteModalOpen(false);
      setBudgetToDelete(null);
    } catch {
      // Error handled by mutation
    }
  };

  const toggleCategory = (opt: CategoryOption) => {
    setFormData((prev) => {
      const isChecked = prev.categoryIds.includes(opt.id);
      if (opt.isSub) {
        return {
          ...prev,
          categoryIds: isChecked
            ? prev.categoryIds.filter((id) => id !== opt.id)
            : [...prev.categoryIds, opt.id],
        };
      }
      // Parent: toggle parent + all subcategories
      const idsToToggle = [opt.id, ...opt.subIds];
      if (isChecked) {
        return {
          ...prev,
          categoryIds: prev.categoryIds.filter((id) => !idsToToggle.includes(id)),
        };
      }
      return {
        ...prev,
        categoryIds: [...new Set([...prev.categoryIds, ...idsToToggle])],
      };
    });
  };


  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header-clean">
          <div className="page-header-left">
            <div className="page-header-icon">
              <Wallet size={26} strokeWidth={1.5} />
            </div>
            <div className="page-header-text">
              <h1>{t("budgets.title")}</h1>
              <p>{t("budgets.heroSubtitle")}</p>
            </div>
          </div>
        </header>
        <div className="budgets-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <Wallet size={26} strokeWidth={1.5} />
          </div>
          <div className="page-header-text">
            <h1>{t("budgets.title")}</h1>
            <p>{t("budgets.heroSubtitle")}</p>
          </div>
        </div>
        <button type="button" className="add-btn" onClick={() => openModal("create")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{t("budgets.add")}</span>
        </button>
      </header>

      <div className="budgets-grid">
        {budgets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Wallet size={48} strokeWidth={1.5} />
            </div>
            <p>{t("budgets.noBudgets")}</p>
            <p style={{ fontSize: "0.9rem", color: "var(--gris-claro)", marginTop: "0.25rem" }}>
              {t("budgets.noBudgetsText")}
            </p>
          </div>
        ) : isMobile ? (
          <SwipeToRevealGroup className="budgets-grid budgets-grid--swipe">
            {budgets.map((budget) => {
              const amount = Number(budget.amount);
              const spent = Number(budget.spent ?? 0);
              const remaining = Math.max(0, amount - spent);
              const over = spent > amount;
              const pct = amount > 0 ? (spent / amount) * 100 : 0;
              const progressValue = amount > 0 ? Math.min(100, pct) : 0;
              const pctWarning = pct >= 80 && !over;
              const accent = budget.color || "var(--accent)";
              const summaryText = over
                ? `${formatCurrency(spent)} / ${formatCurrency(amount)} → ${formatCurrency(spent - amount)} · ${t("budgets.exceeded")}`
                : `${formatCurrency(spent)} / ${formatCurrency(amount)} → ${formatCurrency(remaining)}`;
              const firstCategoryEmoji = budget.categoryIds?.length ? categoryIdToEmoji.get(budget.categoryIds[0]) : undefined;
              const cardContent = (
                <div
                  className={`budget-card ${over ? "budget-card--over" : ""}`}
                  style={{ "--accent-budget": accent } as React.CSSProperties}
                >
                  <div className="budget-card-header">
                  </div>
                  <div className="budget-card-badges-row">
                    <span className="budget-card-icon-blur" aria-hidden>
                      {firstCategoryEmoji ? (
                        <span className="budget-card-emoji">{firstCategoryEmoji}</span>
                      ) : (
                        <Wallet size={20} strokeWidth={1.5} />
                      )}
                    </span>
                    {budget.categoryIds?.length ? (
                      <div className="budget-card-badges">
                        {(budget.categoryIds as string[])
                          .map((id) => ({ id, name: categoryIdToName.get(id) }))
                          .filter((x): x is { id: string; name: string } => Boolean(x.name))
                          .map(({ id: catId, name }) => (
                            <span key={catId} className="budget-card-badge">{name}</span>
                          ))}
                      </div>
                    ) : (
                      <div className="budget-card-badges">
                        <span className="budget-card-badge budget-card-badge--general">{t("budgets.generalBudget")}</span>
                      </div>
                    )}
                  </div>
                  <p className="budget-card-summary">
                    {over ? (
                      <>
                        {formatCurrency(spent)} / {formatCurrency(amount)} → {formatCurrency(spent - amount)} ·{" "}
                        <span className="budget-card-summary-exceeded">
                          <AlertTriangle size={14} className="budget-card-exceeded-icon" aria-hidden />
                          {t("budgets.exceeded")}
                        </span>
                      </>
                    ) : (
                      summaryText
                    )}
                  </p>
                  <div className={`budget-card-progress-wrap ${over ? "budget-progress-over" : pctWarning ? "budget-progress-warning" : ""}`}>
                    <Progress value={progressValue} className="h-2 budget-card-progress" />
                    <span className={`budget-card-pct ${over ? "budget-card-pct--over" : pctWarning ? "budget-card-pct--warning" : ""}`}>{Math.round(pct)}%</span>
                  </div>
                </div>
              );
              return (
                <SwipeToReveal
                  key={budget.id}
                  id={budget.id}
                  className="budget-swipe-wrapper"
                  swipeHint
                  desktopMinWidth={768}
                  actions={
                    <div className="budget-swipe-actions">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openModal("edit", budget); }}
                        className="budget-swipe-btn budget-swipe-btn--edit"
                        aria-label={t("common.edit")}
                      >
                        <Pencil className="size-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBudgetToDelete(budget.id); setDeleteModalOpen(true); }}
                        className="budget-swipe-btn budget-swipe-btn--delete"
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="size-5" />
                      </button>
                    </div>
                  }
                >
                  {cardContent}
                </SwipeToReveal>
              );
            })}
          </SwipeToRevealGroup>
        ) : (
          budgets.map((budget) => {
            const amount = Number(budget.amount);
            const spent = Number(budget.spent ?? 0);
            const remaining = Math.max(0, amount - spent);
            const over = spent > amount;
            const pct = amount > 0 ? (spent / amount) * 100 : 0;
            const progressValue = amount > 0 ? Math.min(100, pct) : 0;
            const pctWarning = pct >= 80 && !over;
            const summaryText = over
              ? `${formatCurrency(spent)} / ${formatCurrency(amount)} → ${formatCurrency(spent - amount)} · ${t("budgets.exceeded")}`
              : `${formatCurrency(spent)} / ${formatCurrency(amount)} → ${formatCurrency(remaining)}`;
            return (
              <div
                key={budget.id}
                className={`budget-card ${over ? "budget-card--over" : ""}`}
                style={{ "--accent-budget": budget.color || "var(--accent)" } as React.CSSProperties}
              >
                <div className="budget-card-header">
                  <div className="budget-card-actions">
                    <button
                      type="button"
                      className="budget-card-action-btn budget-card-action-btn--edit"
                      onClick={(e) => { e.stopPropagation(); openModal("edit", budget); }}
                      aria-label={t("common.edit")}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      type="button"
                      className="budget-card-action-btn budget-card-action-btn--delete"
                      onClick={(e) => { e.stopPropagation(); setBudgetToDelete(budget.id); setDeleteModalOpen(true); }}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="budget-card-badges-row">
                  <span className="budget-card-icon-blur" aria-hidden>
                    {budget.categoryIds?.length && categoryIdToEmoji.get(budget.categoryIds[0]) ? (
                      <span className="budget-card-emoji">{categoryIdToEmoji.get(budget.categoryIds[0])}</span>
                    ) : (
                      <Wallet size={20} strokeWidth={1.5} />
                    )}
                  </span>
                  {budget.categoryIds?.length ? (
                    <div className="budget-card-badges">
                      {(budget.categoryIds as string[])
                        .map((id) => ({ id, name: categoryIdToName.get(id) }))
                        .filter((x): x is { id: string; name: string } => Boolean(x.name))
                        .map(({ id: catId, name }) => (
                          <span key={catId} className="budget-card-badge">{name}</span>
                        ))}
                    </div>
                  ) : (
                    <div className="budget-card-badges">
                      <span className="budget-card-badge budget-card-badge--general">{t("budgets.generalBudget")}</span>
                    </div>
                  )}
                </div>
                <p className="budget-card-summary">
                  {over ? (
                    <>
                      {formatCurrency(spent)} / {formatCurrency(amount)} → {formatCurrency(spent - amount)} ·{" "}
                      <span className="budget-card-summary-exceeded">
                        <AlertTriangle size={14} className="budget-card-exceeded-icon" aria-hidden />
                        {t("budgets.exceeded")}
                      </span>
                    </>
                  ) : (
                    summaryText
                  )}
                </p>
                <div className={`budget-card-progress-wrap ${over ? "budget-progress-over" : pctWarning ? "budget-progress-warning" : ""}`}>
                  <Progress value={progressValue} className="h-2 budget-card-progress" />
                  <span className={`budget-card-pct ${over ? "budget-card-pct--over" : pctWarning ? "budget-card-pct--warning" : ""}`}>{Math.round(pct)}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop modal-backdrop--budget" onClick={closeModal}>
          <div className="modal-content modal-content-subs modal-content-budget overflow-x-hidden max-w-[100vw]" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">
              {modalMode === "create" ? t("budgets.add") : t("budgets.edit")}
            </h2>
            <form onSubmit={handleSave} className="subs-form">
              <div className="subs-form-section">
                <Label className="subs-form-label" htmlFor="budget-amount" required>
                  {t("budgets.monthlyLimit")} (€)
                </Label>
                <InputGroup className="!h-10">
                  <InputGroupInput
                    id="budget-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t("budgets.amountPlaceholder")}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                  <InputGroupAddon align="inline-end">€</InputGroupAddon>
                </InputGroup>
              </div>
              <div className="subs-form-section">
                <Label className="subs-form-label">{t("common.color")}</Label>
                <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="budget-modal-color-btn"
                      style={{ backgroundColor: formData.color }}
                      aria-label={t("common.color")}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start" style={{ zIndex: 2100 }}>
                    <div className="grid grid-cols-3 gap-2">
                      {colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="size-6 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
                          style={{
                            backgroundColor: c,
                            border: formData.color === c ? "2px solid var(--blanco)" : "none",
                          }}
                          onClick={() => {
                            setFormData({ ...formData, color: c });
                            setColorPickerOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="subs-form-section">
                <Label className="subs-form-label" optional>
                  {t("budgets.linkedCategories")}
                </Label>
                <p style={{ fontSize: "0.8rem", color: "var(--gris-claro)", marginBottom: "0.5rem" }}>
                  {t("budgets.generalBudget")} {lang === "es" ? "si no eliges ninguna" : "if you leave none selected"}
                </p>
                <ScrollArea className="h-[140px] w-full max-w-full rounded-md border border-[var(--gris)] p-2 [&_[data-slot=scroll-area-viewport]]:overflow-x-hidden">
                  <div className="flex flex-col gap-1 min-w-0">
                    {categoryOptions.map((opt) => (
                      <label
                        key={opt.id}
                        className="flex items-center gap-2 cursor-pointer py-1 min-w-0"
                        style={{ paddingLeft: opt.isSub ? "1.25rem" : 0 }}
                      >
                        <Checkbox
                          checked={
                            opt.isSub
                              ? formData.categoryIds.includes(opt.id)
                              : formData.categoryIds.includes(opt.id) || (opt.subIds.length > 0 && opt.subIds.every((id) => formData.categoryIds.includes(id)))
                          }
                          onCheckedChange={() => toggleCategory(opt)}
                        />
                        <span className="text-sm truncate">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="outline" onClick={closeModal}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createBudget.isPending || updateBudget.isPending}>
                  {(createBudget.isPending || updateBudget.isPending) && <Spinner className="mr-2 size-4" />}
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)] mx-auto mb-2">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <AlertDialogTitle className="text-center">{t("budgets.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">{t("budgets.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteBudget.isPending}
              variant="destructive"
              className="!bg-[var(--danger)] hover:!bg-[var(--danger-hover)] text-white border-0"
            >
              {deleteBudget.isPending && <Spinner className="size-4 mr-2" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
