"use client";

import { useState } from "react";
import { Chips, FieldGroup, FieldStack, SheetButton } from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { merchantName, type CategoryPair } from "@/lib/review/classify";
import type { ReviewItem } from "@/lib/review/types";

/** Every category as chips, with "remember it for this merchant" on by default. */
export function ReviewCategorySheet({ open, onOpenChange, item, pair, learn, onPick }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ReviewItem;
  pair: CategoryPair;
  learn: boolean;
  onPick: (pair: CategoryPair, learn: boolean) => void;
}) {
  const t = useTranslations(useLang());
  const name = merchantName(item.description || item.bank_description);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("review.category.title")} description={`${name} · ${formatCurrency(item.amount)}`}>
      {open && <CategoryForm key={item.id} item={item} pair={pair} learn={learn} onPick={onPick} />}
    </Sheet>
  );
}

function CategoryForm({ item, pair, learn, onPick }: { item: ReviewItem; pair: CategoryPair; learn: boolean; onPick: (pair: CategoryPair, learn: boolean) => void }) {
  const t = useTranslations(useLang());
  const { data } = useCategories();
  const lookup = useCategoryLookup();
  const [categoryId, setCategoryId] = useState(pair.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(pair.subcategory_id ?? "");
  const [remember, setRemember] = useState(learn);
  const parents = [...(data?.userCategories ?? []), ...(data?.defaultCategories ?? [])].filter((c) => !c.parent_id);
  const category = parents.find((c) => c.id === categoryId);
  const subcategories = category?.subcategories ?? [];
  const label = (c: { id: string; name: string }) => lookup.name.get(c.id) ?? c.name;
  const name = merchantName(item.description || item.bank_description);

  return (
    <>
      <SheetBody>
        <FieldGroup>
          <FieldStack>
            <Chips
              label={t("review.category.title")}
              value={categoryId}
              onChange={(id) => {
                setCategoryId(id);
                setSubcategoryId("");
              }}
              options={parents.map((c) => ({ value: c.id, label: label(c), icon: c.emoji ? <span className="sf-chip-emoji">{c.emoji}</span> : undefined }))}
            />
          </FieldStack>
          {subcategories.length > 0 && (
            <FieldStack label={t("tx.subcategory")}>
              <Chips
                label={t("tx.subcategory")}
                value={subcategoryId}
                onChange={(id) => setSubcategoryId(id === subcategoryId ? "" : id)}
                options={subcategories.map((c) => ({ value: c.id, label: label(c), icon: c.emoji ? <span className="sf-chip-emoji">{c.emoji}</span> : undefined }))}
              />
            </FieldStack>
          )}
        </FieldGroup>
        {item.pattern && (
          <FieldGroup>
            <label className="lp-row lp-pref">
              <span className="lp-main">
                <span className="lp-title">
                  <span>{interpolate(t("review.category.remember"), { pattern: item.pattern })}</span>
                </span>
                <span className="lp-desc">{interpolate(t("review.category.rememberDesc"), { name })}</span>
              </span>
              <Switch className="lp-pref-control" checked={remember} onCheckedChange={setRemember} aria-label={interpolate(t("review.category.remember"), { pattern: item.pattern })} />
            </label>
          </FieldGroup>
        )}
      </SheetBody>
      <SheetFooter>
        <SheetButton type="button" disabled={!categoryId} onClick={() => onPick({ category_id: categoryId, subcategory_id: subcategoryId || null }, remember && !!item.pattern)}>
          {t("review.category.apply")}
        </SheetButton>
      </SheetFooter>
    </>
  );
}
