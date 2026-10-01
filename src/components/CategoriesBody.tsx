"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, Plus, SquarePen, Tags, Trash2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import EmojiPicker from "@/components/EmojiPicker";
import { PageHeader } from "@/components/PageHeader";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { AddButton } from "@/components/ui/add-button";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useArchiveCategory,
  useArchivedCategories,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUnarchiveCategory,
  useUpdateCategory,
  type CategoryItem,
  type CategoryWithSubs,
} from "@/hooks/useCategories";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

type Category = (CategoryWithSubs | CategoryItem) & { isArchived?: boolean };
type FormState = { mode: "create" | "createSub" | "edit"; id?: string; parentId?: string; name: string; emoji: string };

const WithTooltip = ({ tip, children }: { tip: string; children: React.ReactElement }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>
      <p>{tip}</p>
    </TooltipContent>
  </Tooltip>
);

/** Create / create-subcategory / edit category dialog body. */
function CategoryForm({ initial, onClose }: { initial: FormState; onClose: () => void }) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const [form, setForm] = useState(initial);
  const { mode } = form;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    const emoji = form.emoji || null;
    if (mode === "edit" && form.id) await updateCategory.mutateAsync({ id: form.id, name: form.name, emoji });
    else await createCategory.mutateAsync({ name: form.name, parent_id: mode === "createSub" ? form.parentId : null, emoji });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">{t(mode === "create" ? "categories.add" : mode === "createSub" ? "categories.addSub" : "common.edit")}</DialogTitle>
        <DialogDescription className="text-center">
          {mode === "createSub"
            ? es ? "Añade una subcategoría" : "Add a subcategory"
            : mode === "edit"
              ? es ? "Modifica los detalles de la categoría" : "Edit category details"
              : es ? "Crea una nueva categoría personalizada" : "Create a new custom category"}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label className="subs-form-label" optional>
            Emoji
          </Label>
          <EmojiPicker value={form.emoji || null} onChange={(emoji) => setForm({ ...form, emoji })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="subs-form-label" htmlFor="cat-name" required>
            {t("settings.name")}
          </Label>
          <Input
            id="cat-name"
            type="text"
            required
            placeholder={es ? "Nombre de la categoría" : "Category name"}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10"
          />
        </div>
        <DialogFooter className="sm:justify-center gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <SubmitButton pending={createCategory.isPending || updateCategory.isPending} isEdit={mode === "edit"} className="gap-2">
            {mode === "edit" ? t("common.save") : es ? "Crear" : "Create"}
          </SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

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
  const [form, setForm] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const activeForm = form ?? (createOpen ? { mode: "create" as const, name: "", emoji: "" } : null);
  const closeForm = () => {
    setForm(null);
    setCreateOpen(false);
  };

  const renderRow = (cat: Category, isSub: boolean, isLast: boolean, isArchived: boolean) => {
    const excluded = cat.exclude_from_metrics;
    const busy = (pending: boolean, id?: string) => pending && id === cat.id;
    const archiving = busy(archiveCategory.isPending, archiveCategory.variables?.id);
    const restoring = busy(unarchiveCategory.isPending, unarchiveCategory.variables);

    const actions = (
      <div className="cat-row-actions">
        {isArchived ? (
          <WithTooltip tip={es ? "Recuperar" : "Restore"}>
            <button type="button" className="cat-row-btn unarchive" onClick={() => unarchiveCategory.mutate(cat.id)} disabled={restoring} title={es ? "Recuperar" : "Restore"}>
              {restoring ? <Spinner className="size-4" /> : <ArchiveRestore className="size-4" />}
            </button>
          </WithTooltip>
        ) : (
          <>
            {!isSub && !excluded && (
              <button type="button" className="cat-row-btn add" onClick={() => setForm({ mode: "createSub", parentId: cat.id, name: "", emoji: "" })} title={t("categories.addSub")}>
                <Plus className="size-4" strokeWidth={2.5} />
              </button>
            )}
            {!cat.isDefault && (
              <>
                <button
                  type="button"
                  className="cat-row-btn edit"
                  onClick={() => setForm({ mode: "edit", id: cat.id, name: cat.name, emoji: cat.emoji ?? "" })}
                  title={t("common.edit")}
                >
                  <SquarePen className="size-4" />
                </button>
                <button type="button" className="cat-row-btn delete" onClick={() => setToDelete({ id: cat.id, name: cat.name })} title={t("common.delete")}>
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
            {cat.isDefault && !excluded && (
              <WithTooltip tip={es ? "Archivar" : "Archive"}>
                <button
                  type="button"
                  className="cat-row-btn archive"
                  onClick={() => archiveCategory.mutate({ id: cat.id, archiveChildren: !isSub })}
                  disabled={archiving}
                  title={es ? "Archivar" : "Archive"}
                >
                  {archiving ? <Spinner className="size-4" /> : <Archive className="size-4" />}
                </button>
              </WithTooltip>
            )}
          </>
        )}
      </div>
    );

    return (
      <SwipeToReveal
        key={cat.id}
        id={cat.id}
        className={cn("cat-row", isSub ? "cat-row-sub" : "cat-row-parent", cat.isDefault && "cat-row-default", isLast && "cat-row-last")}
        contentClassName="flex items-center flex-1 min-w-0"
        swipeHint
        actions={actions}
      >
        {isSub && (
          <div className="cat-tree-line">
            <span className={cn("cat-tree-connector", isLast && "last")} />
          </div>
        )}
        <div className="cat-row-main">
          <span className="cat-row-icon cat-row-emoji">{cat.emoji || "🏷️"}</span>
          <span className="cat-row-name">{cat.isDefault && cat.name_en && !es ? cat.name_en : cat.name}</span>
          {excluded && !isArchived && <span className="cat-row-badge cat-row-badge-exclude">{t("categories.excludeFromMetricsBadge")}</span>}
          {cat.isDefault && !isArchived && !excluded && (
            <WithTooltip tip={es ? "No modificable" : "Not editable"}>
              <span className="cat-row-badge">{es ? "Sistema" : "System"}</span>
            </WithTooltip>
          )}
        </div>
        {excluded && !isArchived && (
          <p className="mt-2 text-sm text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">{t("categories.excludeFromMetricsInfo")}</p>
        )}
      </SwipeToReveal>
    );
  };

  const renderGroup = (cat: CategoryWithSubs & { isArchived?: boolean }, archived = false) => {
    const isArchived = cat.isArchived ?? archived;
    const subs = (cat.subcategories ?? []) as Category[];
    return (
      <div key={cat.id} className="cat-group">
        {renderRow(cat, false, false, isArchived)}
        {subs.length > 0 && <div className="cat-subs">{subs.map((sub, i) => renderRow(sub, true, i === subs.length - 1, sub.isArchived ?? isArchived))}</div>}
      </div>
    );
  };

  const header = (
    <PageHeader icon={<Tags size={26} strokeWidth={1.5} />} title={t("categories.title")} subtitle={t("categories.heroSubtitle")}>
      {!isLoading && <AddButton onClick={() => setCreateOpen(true)}>{t("categories.add")}</AddButton>}
    </PageHeader>
  );

  if (isLoading) {
    return (
      <div className="page-container">
        {header}
        <div className="cat-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
          ))}
        </div>
      </div>
    );
  }

  const userCategories = data?.userCategories ?? [];
  const archivedCategories = archivedData?.defaultCategories ?? [];
  return (
    <div className="page-container fade-in">
      {header}

      {userCategories.length > 0 && (
        <section className="cat-section">
          <h2 className="cat-section-title">{es ? "Mis categorías" : "My categories"}</h2>
          <SwipeToRevealGroup className="cat-list">{userCategories.map((cat) => renderGroup(cat))}</SwipeToRevealGroup>
        </section>
      )}

      <section className="cat-section">
        <h2 className="cat-section-title">{es ? "Categorías del sistema" : "System categories"}</h2>
        <SwipeToRevealGroup className="cat-list">{(data?.defaultCategories ?? []).map((cat) => renderGroup(cat))}</SwipeToRevealGroup>
      </section>

      {archivedCategories.length > 0 && (
        <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
          <CollapsibleTrigger className="subs-collapsible-trigger">
            <span>{es ? "Archivadas" : "Archived"}</span>
            <span className="subs-section-count">{archivedCategories.length}</span>
            <ChevronDown className={cn("size-4 transition-transform duration-300", archivedOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SwipeToRevealGroup className="cat-list" style={{ paddingTop: 12 }}>
              {archivedCategories.map((cat) => renderGroup(cat, true))}
            </SwipeToRevealGroup>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Dialog open={!!activeForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="sm:max-w-md">{activeForm && <CategoryForm key={`${activeForm.mode}-${activeForm.id ?? activeForm.parentId}`} initial={activeForm} onClose={closeForm} />}</DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={es ? "Eliminar categoría" : "Delete category"}
        description={es ? `¿Estás seguro de que quieres eliminar "${toDelete?.name}"?` : `Are you sure you want to delete "${toDelete?.name}"?`}
        pending={deleteCategory.isPending}
        onConfirm={async () => {
          if (toDelete) await deleteCategory.mutateAsync(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
