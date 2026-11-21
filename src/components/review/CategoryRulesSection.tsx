"use client";

import { Info, Trash2 } from "lucide-react";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useCategoryRules, useDeleteCategoryRule } from "@/hooks/useReview";
import { useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";

/** Categories screen: what the review deck learnt ("AMAZON MKTPLACE" → Technology), each one can be forgotten. */
export function CategoryRulesSection() {
  const t = useTranslations(useLang());
  const { data: rules = [] } = useCategoryRules();
  const remove = useDeleteCategoryRule();
  const lookup = useCategoryLookup();
  if (rules.length === 0) return null;

  return (
    <section className="lp-section">
      <div className="lp-section-head">
        <span className="lp-section-title">
          {t("categories.rules.title")} · {rules.length}
        </span>
      </div>
      <div className="lp-card lp-group">
        {rules.map((rule) => {
          const id = rule.subcategory_id ?? rule.category_id;
          const emoji = (rule.subcategory_id && lookup.emoji.get(rule.subcategory_id)) || (rule.category_id && lookup.emoji.get(rule.category_id)) || "🏷️";
          return (
            <div key={rule.id} className="lp-row lp-row--static">
              <span className="lp-icon" aria-hidden>
                {emoji}
              </span>
              <span className="lp-main">
                <span className="lp-title">
                  <span className="rule-pattern">{rule.pattern}</span>
                </span>
                <span className="lp-meta">
                  <span className="lp-truncate">{id ? lookup.name.get(id) : ""}</span>
                </span>
              </span>
              <button
                type="button"
                className="lp-icon-btn"
                aria-label={`${t("categories.rules.delete")} ${rule.pattern}`}
                onClick={() =>
                  remove.mutate(rule.id, {
                    onSuccess: () => toast(t("categories.rules.deleted"), { icon: <Trash2 /> }),
                  })
                }
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
      <p className="lp-note">
        <Info className="size-3.5" aria-hidden />
        {t("categories.rules.hint")}
      </p>
    </section>
  );
}
