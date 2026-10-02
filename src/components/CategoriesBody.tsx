"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, ChevronsLeft, Info, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Bones } from "@/components/Bones";
import { CategorySheet, type CategoryFormState } from "@/components/CategorySheet";
import { ConfirmDeleteSheet } from "@/components/ConfirmSheet";
import { CompactPageHeader } from "@/components/PageHeader";
import { SwipeToReveal, SwipeToRevealGroup, useSwipeLearned } from "@/components/SwipeToReveal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import {
  useArchiveCategory,
  useArchivedCategories,
  useCategories,
  useDeleteCategory,
  useUnarchiveCategory,
  type CategoryItem,
  type CategoryWithSubs,
} from "@/hooks/useCategories";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

type Category = (CategoryWithSubs | CategoryItem) & { isArchived?: boolean };

const NEW_CATEGORY: CategoryFormState = { mode: "create", name: "", emoji: "" };

export default function CategoriesBody() {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const { data, isLoading } = useCategories();
  const { data: archivedData } = useArchivedCategories();
  const deleteCategory = useDeleteCategory();
  const archiveCategory = useArchiveCategory();
  const unarchiveCategory = useUnarchiveCategory();
  const [createOpen, setCreateOpen] = useCreateDialog();
  const [form, setForm] = useState<CategoryFormState | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const swipeLearned = useSwipeLearned();
  const showSwipeHint = !isDesktop && !swipeLearned;
  const activeForm = form ?? (createOpen ? NEW_CATEGORY : null);
  const closeForm = () => {
    setForm(null);
    setCreateOpen(false);
  };
  const edit = (cat: Category) => setForm({ mode: "edit", id: cat.id, name: cat.name, emoji: cat.emoji ?? "" });

  const renderRow = (cat: Category, isSub: boolean, isArchived: boolean, subCount = 0, peek = false) => {
    const excluded = !!cat.exclude_from_metrics;
    const editable = !cat.isDefault && !isArchived;
    // User categories (and user subcategories under system ones) carry the accent tint + bar.
    const own = !cat.isDefault && !isArchived;
    const busy = (pending: boolean, id?: string) => pending && id === cat.id;
    const archiving = busy(archiveCategory.isPending, archiveCategory.variables?.id);
    const restoring = busy(unarchiveCategory.isPending, unarchiveCategory.variables);
    const action = (className: string, label: string, onClick: () => void, icon: React.ReactNode, disabled?: boolean) => (
      <button
        key={label}
        type="button"
        className={`lp-action ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        disabled={disabled}
        aria-label={label}
        title={label}
      >
        {icon}
      </button>
    );

    const restoreLabel = es ? "Restaurar" : "Restore";
    const actions = isArchived
      ? []
      : [
          !isSub &&
            !excluded &&
            action("lp-action--add", t("categories.addSub"), () => setForm({ mode: "createSub", parentId: cat.id, name: "", emoji: "" }), <Plus className="size-5" strokeWidth={2.5} />),
          editable && action("lp-action--edit", t("common.edit"), () => edit(cat), <Pencil className="size-5" />),
          editable && action("lp-action--danger", t("common.delete"), () => setToDelete({ id: cat.id, name: cat.name }), <Trash2 className="size-5" />),
          cat.isDefault &&
            !excluded &&
            action(
              "lp-action--warn",
              es ? "Archivar" : "Archive",
              () => archiveCategory.mutate({ id: cat.id, archiveChildren: !isSub }),
              archiving ? <Spinner className="size-5" /> : <Archive className="size-5" />,
              archiving
            ),
        ].filter(Boolean);

    // User categories open the edit dialog on tap; system ones only expose their swipe actions.
    const row = (
      <div
        className={cn("lp-row", isSub && "lp-row--sub", isArchived && "lp-row--dim", !editable && "lp-row--static")}
        {...(editable && {
          role: "button",
          tabIndex: 0,
          onClick: () => edit(cat),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
            e.preventDefault();
            edit(cat);
          },
        })}
      >
        <span className="lp-icon" aria-hidden>
          {cat.emoji || "🏷️"}
        </span>
        <span className="lp-main">
          <span className="lp-title">
            <span>{cat.isDefault && cat.name_en && !es ? cat.name_en : cat.name}</span>
          </span>
          {excluded && !isArchived ? (
            <span className="lp-meta">
              <span className="lp-badge lp-badge--warn">{t("categories.excludeFromMetricsBadge")}</span>
            </span>
          ) : (
            subCount > 0 && (
              <span className="lp-meta">
                {subCount} {es ? (subCount === 1 ? "subcategoría" : "subcategorías") : subCount === 1 ? "subcategory" : "subcategories"}
              </span>
            )
          )}
        </span>
        {isArchived && (
          <button
            type="button"
            className="lp-chip lp-restore"
            onClick={() => unarchiveCategory.mutate(cat.id)}
            disabled={restoring}
            aria-label={`${restoreLabel} ${cat.isDefault && cat.name_en && !es ? cat.name_en : cat.name}`}
          >
            {restoring ? <Spinner className="size-3.5" /> : <ArchiveRestore className="size-3.5" />}
            {restoreLabel}
          </button>
        )}
      </div>
    );

    if (actions.length === 0) {
      return (
        <div key={cat.id} className={cn(isSub && "lp-sub", own && "lp-own")}>
          {row}
        </div>
      );
    }
    return (
      <SwipeToReveal key={cat.id} id={cat.id} className={cn("lp-swipe lp-swipe--3", isSub && "lp-sub", own && "lp-own")} desktopMinWidth={1024} peek={peek} actions={actions}>
        {row}
      </SwipeToReveal>
    );
  };

  /** One card per section: each parent row is followed by its subcategories. */
  const renderList = (cats: (CategoryWithSubs & { isArchived?: boolean })[], archived = false, peek = false) => (
    <SwipeToRevealGroup className="lp-card lp-group">
      {cats.flatMap((cat, i) => {
        const isArchived = cat.isArchived ?? archived;
        const subs = (cat.subcategories ?? []) as Category[];
        return [renderRow(cat, false, isArchived, subs.length, peek && i === 0), ...subs.map((sub) => renderRow(sub, true, sub.isArchived ?? isArchived))];
      })}
    </SwipeToRevealGroup>
  );

  const header = <CompactPageHeader title={t("categories.title")} addLabel={t("categories.add")} onAdd={() => setCreateOpen(true)} />;

  if (isLoading) {
    return (
      <div className="page-container lp-page">
        {header}
        <Bones
          name="categories"
          loading
          fallback={
            <div className="lp-layout">
              <div className="lp-aside">
                <div className="skeleton" style={{ height: 66, borderRadius: 16 }} />
              </div>
              <div className="lp-content">
                <div className="skeleton" style={{ height: 6 * 57, borderRadius: 16 }} />
              </div>
            </div>
          }
        />
      </div>
    );
  }

  const userCategories = data?.userCategories ?? [];
  const defaultCategories = data?.defaultCategories ?? [];
  const archivedCategories = archivedData?.defaultCategories ?? [];
  const countWithSubs = (cats: CategoryWithSubs[]) => cats.reduce((sum, cat) => sum + 1 + (cat.subcategories?.length ?? 0), 0);
  const hasExcluded = defaultCategories.some((cat) => cat.exclude_from_metrics || cat.subcategories?.some((sub) => sub.exclude_from_metrics));
  const stat = (label: string, value: number, own = false) => (
    <div className="lp-stat">
      <span className={cn("lp-label", own && "lp-label--own")}>{label}</span>
      <span className="lp-stat-value">{value}</span>
    </div>
  );
  const sectionHead = (title: string, count: number, own = false) => (
    <div className="lp-section-head">
      <span className={cn("lp-section-title", own && "lp-section-title--own")}>
        {title} · {count}
      </span>
    </div>
  );

  return (
    <div className="page-container lp-page fade-in">
      {header}

      <Bones name="categories" loading={false}>
        <div className="lp-layout">
          <aside className="lp-aside">
            <div className="lp-card lp-summary">
              <div className="lp-stats">
                {stat(es ? "Propias" : "Custom", countWithSubs(userCategories), true)}
                {stat(es ? "Sistema" : "System", countWithSubs(defaultCategories))}
                {stat(es ? "Archivadas" : "Archived", countWithSubs(archivedCategories))}
              </div>
            </div>
          </aside>

          <div className="lp-content">
            {showSwipeHint && (
              <p className="lp-note lp-swipe-tip">
                <ChevronsLeft className="size-3.5" aria-hidden />
                {es ? "Desliza una categoría a la izquierda para ver sus opciones" : "Swipe a category left to see its options"}
              </p>
            )}
            {userCategories.length > 0 ? (
              <section className="lp-section">
                {sectionHead(es ? "Mis categorías" : "My categories", userCategories.length, true)}
                {renderList(userCategories, false, true)}
              </section>
            ) : (
              <div className="lp-card lp-empty">
                <div className="lp-empty-icon">
                  <Tags size={24} strokeWidth={2.5} />
                </div>
                <p className="lp-empty-title">{es ? "Sin categorías propias" : "No custom categories"}</p>
                <p className="lp-empty-text">
                  {es ? "Crea las tuyas o añade subcategorías a las del sistema" : "Create your own or add subcategories to the system ones"}
                </p>
                <button type="button" className="lp-chip" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" strokeWidth={2.5} />
                  {t("categories.add")}
                </button>
              </div>
            )}

            <section className="lp-section">
              {sectionHead(es ? "Sistema" : "System", defaultCategories.length)}
              {renderList(defaultCategories, false, userCategories.length === 0)}
              {hasExcluded && (
                <p className="lp-note">
                  <Info className="size-3.5" aria-hidden />
                  {t("categories.excludeFromMetricsInfo")}
                </p>
              )}
            </section>

            {archivedCategories.length > 0 && (
              <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen} className="lp-section">
                <CollapsibleTrigger className="lp-collapse-trigger">
                  <span>
                    {es ? "Archivadas" : "Archived"} · {archivedCategories.length}
                  </span>
                  <ChevronDown className="size-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="subs-collapsible-content">
                  <div className="subs-collapsible-inner">{renderList(archivedCategories, true)}</div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </Bones>

      <CategorySheet form={activeForm} onClose={closeForm} />

      <ConfirmDeleteSheet
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete && (es ? `¿Eliminar «${toDelete.name}»?` : `Delete “${toDelete.name}”?`)}
        description={es ? "Esta acción no se puede deshacer." : "This can't be undone."}
        confirmLabel={es ? "Sí, eliminar" : "Yes, delete"}
        pending={deleteCategory.isPending}
        onConfirm={async () => {
          if (toDelete) await deleteCategory.mutateAsync(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
