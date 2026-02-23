"use client";

import { useState } from "react";
import { useCategories, useArchivedCategories, CategoryWithSubs } from "@/hooks/useCategories";
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useArchiveCategory,
  useUnarchiveCategory,
} from "@/hooks/useCategoryMutations";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CategoryItem } from "@/hooks/useCategories";
import { Tags, ChevronDown, Archive, ArchiveRestore } from "lucide-react";
import EmojiPicker from "@/components/EmojiPicker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";

export default function CategoriesBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data, isLoading } = useCategories();
  const { data: archivedData } = useArchivedCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const archiveCategory = useArchiveCategory();
  const unarchiveCategory = useUnarchiveCategory();

  const defaultCategories = data?.defaultCategories ?? [];
  const userCategories = data?.userCategories ?? [];
  const archivedCategories = archivedData?.defaultCategories ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "createSub">("create");
  const [formData, setFormData] = useState({ id: "", name: "", parent_id: "", emoji: "" });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const resetForm = () => {
    setFormData({ id: "", name: "", parent_id: "", emoji: "" });
  };

  const openModal = (
    mode: "create" | "edit" | "createSub",
    data?: { id?: string; name?: string; parentId?: string; emoji?: string }
  ) => {
    setIsModalOpen(true);
    setModalMode(mode);
    setFormData({
      id: data?.id || "",
      name: data?.name || "",
      parent_id: data?.parentId || "",
      emoji: data?.emoji || "",
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (modalMode === "create" || modalMode === "createSub") {
      await createCategory.mutateAsync({
        name: formData.name,
        parent_id: modalMode === "createSub" ? formData.parent_id : null,
        emoji: formData.emoji || null,
      });
    } else if (formData.id) {
      await updateCategory.mutateAsync({
        id: formData.id,
        name: formData.name,
        emoji: formData.emoji || null,
      });
    }
    closeModal();
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    await deleteCategory.mutateAsync(categoryToDelete.id);
    setDeleteModalOpen(false);
    setCategoryToDelete(null);
  };

  const getCategoryName = (cat: CategoryWithSubs) => {
    if (cat.isDefault && cat.name_en) {
      return lang === "es" ? cat.name : cat.name_en;
    }
    return cat.name;
  };


  const renderCategoryRow = (
    cat: CategoryWithSubs | CategoryItem,
    isSubcategory = false,
    isLast = false,
    isArchived = false
  ) => {
    const canEdit = !cat.isDefault;
    const canAddSub = !isSubcategory;
    const canArchive = cat.isDefault && !isArchived;

    const actions = (
      <div className="cat-row-actions">
          {isArchived ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="cat-row-btn unarchive"
                    onClick={() => unarchiveCategory.mutate(cat.id)}
                    disabled={unarchiveCategory.isPending && unarchiveCategory.variables === cat.id}
                    title={lang === "es" ? "Recuperar" : "Restore"}
                  >
                    {unarchiveCategory.isPending && unarchiveCategory.variables === cat.id ? (
                      <Spinner className="size-4" />
                    ) : (
                      <ArchiveRestore className="size-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{lang === "es" ? "Recuperar" : "Restore"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <>
              {canAddSub && (
                <button
                  type="button"
                  className="cat-row-btn add"
                  onClick={() => openModal("createSub", { parentId: cat.id })}
                  title={t("categories.addSub")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    className="cat-row-btn edit"
                    onClick={() => openModal("edit", { id: cat.id, name: cat.name, emoji: cat.emoji ?? undefined })}
                    title={t("common.edit")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="cat-row-btn delete"
                    onClick={() => {
                      setCategoryToDelete({ id: cat.id, name: cat.name });
                      setDeleteModalOpen(true);
                    }}
                    title={t("common.delete")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              )}
              {canArchive && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="cat-row-btn archive"
                        onClick={() => archiveCategory.mutate({ id: cat.id, archiveChildren: !isSubcategory })}
                        disabled={archiveCategory.isPending && archiveCategory.variables?.id === cat.id}
                        title={lang === "es" ? "Archivar" : "Archive"}
                      >
                        {archiveCategory.isPending && archiveCategory.variables?.id === cat.id ? (
                          <Spinner className="size-4" />
                        ) : (
                          <Archive className="size-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{lang === "es" ? "Archivar" : "Archive"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
      </div>
    );

    const content = (
      <>
        {isSubcategory && (
          <div className="cat-tree-line">
            <span className={`cat-tree-connector ${isLast ? "last" : ""}`} />
          </div>
        )}
        <div className="cat-row-main">
          <span className="cat-row-icon cat-row-emoji">{cat.emoji || "🏷️"}</span>
          <span className="cat-row-name">{getCategoryName(cat as CategoryWithSubs)}</span>
          {cat.isDefault && !isArchived && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cat-row-badge">{lang === "es" ? "Sistema" : "System"}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{lang === "es" ? "No modificable" : "Not editable"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </>
    );

    return (
      <SwipeToReveal
        key={cat.id}
        id={cat.id}
        className={`cat-row ${isSubcategory ? "cat-row-sub" : "cat-row-parent"} ${cat.isDefault ? "cat-row-default" : ""} ${isLast ? "cat-row-last" : ""}`}
        contentClassName="flex items-center flex-1 min-w-0"
        swipeHint
        actions={actions}
      >
        {content}
      </SwipeToReveal>
    );
  };

  const renderCategoryGroup = (cat: CategoryWithSubs, defaultArchived = false) => {
    const catArchived = (cat as CategoryWithSubs & { isArchived?: boolean }).isArchived ?? defaultArchived;
    return (
      <div key={cat.id} className="cat-group">
        {renderCategoryRow(cat, false, false, catArchived)}
        {cat.subcategories && cat.subcategories.length > 0 && (
          <div className="cat-subs">
            {cat.subcategories.map((sub, idx) => {
              const subArchived = (sub as CategoryItem & { isArchived?: boolean }).isArchived ?? catArchived;
              return renderCategoryRow(sub, true, idx === cat.subcategories!.length - 1, subArchived);
            })}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header-clean">
          <div className="page-header-left">
            <div className="page-header-icon">
              <Tags size={26} strokeWidth={1.5} />
            </div>
            <div className="page-header-text">
              <h1>{t("categories.title")}</h1>
              <p>{t("categories.heroSubtitle")}</p>
            </div>
          </div>
        </header>
        <div className="cat-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
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
            <Tags size={26} strokeWidth={1.5} />
          </div>
          <div className="page-header-text">
            <h1>{t("categories.title")}</h1>
            <p>{t("categories.heroSubtitle")}</p>
          </div>
        </div>
        <button type="button" className="add-btn" onClick={() => openModal("create")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{t("categories.add")}</span>
        </button>
      </header>

      {userCategories.length > 0 && (
        <section className="cat-section">
          <h2 className="cat-section-title">
            {lang === "es" ? "Mis categorías" : "My categories"}
          </h2>
          <SwipeToRevealGroup className="cat-list">
            {userCategories.map((cat) => renderCategoryGroup(cat))}
          </SwipeToRevealGroup>
        </section>
      )}

      <section className="cat-section">
        <h2 className="cat-section-title">
          {lang === "es" ? "Categorías del sistema" : "System categories"}
        </h2>
        <SwipeToRevealGroup className="cat-list">
          {defaultCategories.map((cat) => renderCategoryGroup(cat))}
        </SwipeToRevealGroup>
      </section>

      {archivedCategories.length > 0 && (
        <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
          <CollapsibleTrigger className="subs-collapsible-trigger">
            <span>{lang === "es" ? "Archivadas" : "Archived"}</span>
            <span className="subs-section-count">{archivedCategories.length}</span>
            <ChevronDown
              className={`size-4 transition-transform duration-300 ${archivedOpen ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SwipeToRevealGroup className="cat-list" style={{ paddingTop: 12 }}>
              {archivedCategories.map((cat) => renderCategoryGroup(cat, true))}
            </SwipeToRevealGroup>
          </CollapsibleContent>
        </Collapsible>
      )}

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content modal-content-subs" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">
              {modalMode === "create"
                ? t("categories.add")
                : modalMode === "createSub"
                ? t("categories.addSub")
                : t("common.edit")}
            </h2>
            <form onSubmit={handleSave} className="subs-form">
              <div className="subs-form-section">
                <Label className="subs-form-label" optional>
                  {lang === "es" ? "Emoji" : "Emoji"}
                </Label>
                <EmojiPicker
                  value={formData.emoji || null}
                  onChange={(emoji) => setFormData({ ...formData, emoji })}
                />
              </div>
              <div className="subs-form-section">
                <Label className="subs-form-label" htmlFor="cat-name" required>
                  {t("settings.name")}
                </Label>
                <Input
                  id="cat-name"
                  type="text"
                  required
                  placeholder={lang === "es" ? "Nombre de la categoría" : "Category name"}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="!h-10"
                />
              </div>
              <div className="account-modal-actions" style={{ marginTop: 16 }}>
                <Button type="button" variant="ghost" onClick={closeModal} className="account-modal-cancel">
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  className="subs-form-submit account-modal-submit"
                  disabled={createCategory.isPending || updateCategory.isPending}
                >
                  {(createCategory.isPending || updateCategory.isPending) && <Spinner className="size-5 shrink-0" />}
                  {modalMode === "edit" ? t("common.save") : lang === "es" ? "Crear" : "Create"}
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
            <AlertDialogTitle className="text-center">
              {lang === "es" ? "Eliminar categoría" : "Delete category"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {lang === "es"
                ? `¿Estás seguro de que quieres eliminar "${categoryToDelete?.name}"?`
                : `Are you sure you want to delete "${categoryToDelete?.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteCategory.isPending}
              className="bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white"
            >
              {deleteCategory.isPending && <Spinner className="size-4 mr-2" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
