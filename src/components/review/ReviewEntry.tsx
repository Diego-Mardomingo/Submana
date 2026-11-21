"use client";

import Link from "next/link";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useReviewSummary } from "@/hooks/useReview";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { merchantName } from "@/lib/review/classify";

/** Home: "5 to review" with the first three cards in miniature. Only while something is waiting. */
export function ReviewEntry() {
  const t = useTranslations(useLang());
  const { data } = useReviewSummary();
  const lookup = useCategoryLookup();
  if (!data || data.count === 0) return null;
  const names = data.preview.map((p) => merchantName(p.description)).filter(Boolean);
  const rest = data.count - names.length;
  return (
    <Link href="/review" className="rv-entry">
      <span className="rv-entry-deck" aria-hidden>
        {data.preview.map((p) => {
          const emoji = (p.subcategory_id && lookup.emoji.get(p.subcategory_id)) || (p.category_id && lookup.emoji.get(p.category_id));
          return (
            <span key={p.id}>
              {emoji || (
                // eslint-disable-next-line @next/next/no-img-element -- generated initials
                <img src={initialsAvatarDataUri(p.description)} alt="" />
              )}
            </span>
          );
        })}
      </span>
      <span className="rv-entry-text">
        <b>{data.count === 1 ? t("review.entry.countOne") : interpolate(t("review.entry.count"), { n: String(data.count) })}</b>
        {names.length > 0 && <span>{rest > 0 ? interpolate(t("review.entry.names"), { names: names.join(", "), n: String(rest) }) : names.join(", ")}</span>}
      </span>
      <span className="rv-entry-go">{t("review.entry.go")}</span>
    </Link>
  );
}
