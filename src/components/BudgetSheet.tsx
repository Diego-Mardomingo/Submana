"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { AmountField, Chips, DeleteAction, FieldGroup, FieldStack, FormError, FormHero, HeroTile, SheetButton, Swatches } from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { parseCurrencyValue } from "@/lib/currency";
import { useCreateBudget, useDeleteBudget, useUpdateBudget, type BudgetWithSpent } from "@/hooks/useBudgets";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { PALETTE } from "@/lib/palette";

type Lookup = ReturnType<typeof useCategoryLookup>;

/** Top-level categories linked to a budget. */
export const rootIds = (budget: BudgetWithSpent, categories: Lookup) => [...new Set(budget.categoryIds.map((id) => categories.parent.get(id) ?? id))];

function BudgetFormBody({ budget, onDone }: { budget: BudgetWithSpent | null; onDone: () => void }) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const categories = useCategoryLookup();
  const { data: categoriesData } = useCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();
  const [amount, setAmount] = useState(budget ? Number(budget.amount).toFixed(2).replace(".", ",") : "");
  const [color, setColor] = useState<string>(budget?.color && PALETTE.some((c) => c === budget.color) ? budget.color : PALETTE[0]);
  const [categoryIds, setCategoryIds] = useState(budget ? rootIds(budget, categories) : []);
  const [error, setError] = useState("");
  const roots = [...(categoriesData?.userCategories ?? []), ...(categoriesData?.defaultCategories ?? [])];
  const firstEmoji = categoryIds.length ? categories.emoji.get(categoryIds[0]) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseCurrencyValue(amount);
    if (value <= 0) {
      setError(es ? "Introduce un límite mayor que 0" : "Enter a limit greater than 0");
      return;
    }
    try {
      if (budget) await updateBudget.mutateAsync({ id: budget.id, amount: value, color, category_ids: categoryIds });
      else await createBudget.mutateAsync({ amount: value, color, category_ids: categoryIds.length > 0 ? categoryIds : undefined });
      onDone();
    } catch (err) {
      // The mutation rolls back its optimistic update.
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <SheetForm onSubmit={handleSubmit}>
      <SheetBody>
        <FormHero>
          <HeroTile color={color}>{firstEmoji ?? <Wallet size={30} strokeWidth={1.8} />}</HeroTile>
          <AmountField
            id="budget-amount"
            label={t("budgets.monthlyLimit")}
            value={amount}
            onChange={(value) => {
              setAmount(value);
              setError("");
            }}
          />
        </FormHero>

        <FieldGroup
          title={t("budgets.linkedCategories")}
          hint={
            categoryIds.length === 0
              ? es
                ? "Sin categorías, el presupuesto cuenta todos tus gastos."
                : "With no categories, the budget counts all your expenses."
              : es
                ? `Cuenta los gastos de ${categoryIds.length} categoría${categoryIds.length === 1 ? "" : "s"}.`
                : `Counts expenses in ${categoryIds.length} categor${categoryIds.length === 1 ? "y" : "ies"}.`
          }
        >
          <FieldStack>
            <Chips
              multiple
              label={t("budgets.linkedCategories")}
              value={categoryIds}
              onChange={setCategoryIds}
              options={roots.map((cat) => ({
                value: cat.id,
                label: categories.name.get(cat.id) ?? cat.name,
                icon: cat.emoji ? <span className="sf-chip-emoji">{cat.emoji}</span> : undefined,
                color,
              }))}
            />
          </FieldStack>
        </FieldGroup>

        <FieldGroup title={t("common.color")}>
          <FieldStack>
            <Swatches value={color} onChange={setColor} label={t("common.color")} />
          </FieldStack>
        </FieldGroup>

        {budget && (
          <FieldGroup>
            <DeleteAction
              label={es ? "Eliminar presupuesto" : "Delete budget"}
              confirmTitle={t("budgets.deleteTitle")}
              confirmText={t("budgets.deleteConfirm")}
              confirmLabel={es ? "Sí, eliminar" : "Yes, delete"}
              pending={deleteBudget.isPending}
              onConfirm={async () => {
                await deleteBudget.mutateAsync(budget.id);
                onDone();
              }}
            />
          </FieldGroup>
        )}
      </SheetBody>

      <SheetFooter>
        <FormError>{error}</FormError>
        <SheetButton type="submit" pending={createBudget.isPending || updateBudget.isPending}>
          {budget ? (es ? "Guardar cambios" : "Save changes") : es ? "Crear presupuesto" : "Create budget"}
        </SheetButton>
      </SheetFooter>
    </SheetForm>
  );
}

/** Create (no `budget`) or edit / delete a monthly budget. */
export function BudgetSheet({ open, onOpenChange, budget }: { open: boolean; onOpenChange: (open: boolean) => void; budget?: BudgetWithSpent | null }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const shown = useSheetPayload(open, budget ?? null);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(shown ? "budgets.edit" : "budgets.add")}
      description={lang === "es" ? "Un límite de gasto que se renueva cada mes" : "A spending limit that resets every month"}
    >
      <BudgetFormBody budget={shown} onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}
