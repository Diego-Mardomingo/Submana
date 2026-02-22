"use client";

import { useState } from "react";
import { useCategories, CategoryWithSubs } from "@/hooks/useCategories";
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/useCategoryMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { getCategoryIcon, categoryIcons } from "@/lib/categoryIcons";
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
import { CategoryItem } from "@/hooks/useCategories";
import { Tags } from "lucide-react";

export default function CategoriesBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const defaultCategories = data?.defaultCategories ?? [];
  const userCategories = data?.userCategories ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "createSub">("create");
  const [formData, setFormData] = useState({ id: "", name: "", parent_id: "", icon: "" });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const resetForm = () => {
    setFormData({ id: "", name: "", parent_id: "", icon: "" });
    setIconPickerOpen(false);
  };

  const openModal = (
    mode: "create" | "edit" | "createSub",
    data?: { id?: string; name?: string; parentId?: string; icon?: string }
  ) => {
    setIsModalOpen(true);
    setModalMode(mode);
    setFormData({
      id: data?.id || "",
      name: data?.name || "",
      parent_id: data?.parentId || "",
      icon: data?.icon || "",
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
        icon: formData.icon || undefined,
      });
    } else if (formData.id) {
      await updateCategory.mutateAsync({
        id: formData.id,
        name: formData.name,
        icon: formData.icon || undefined,
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

  const iconOptions = Object.keys(categoryIcons);

  const getCategoryName = (cat: CategoryWithSubs) => {
    if (cat.isDefault && cat.name_en) {
      return lang === "es" ? cat.name : cat.name_en;
    }
    return cat.name;
  };

  const renderCategoryRow = (cat: CategoryWithSubs | CategoryItem, isSubcategory = false, isLast = false) => {
    const canEdit = !cat.isDefault;
    const canAddSub = !isSubcategory;
    
    return (
      <div
        className={`cat-row ${isSubcategory ? "cat-row-sub" : "cat-row-parent"} ${cat.isDefault ? "cat-row-default" : ""} ${isLast ? "cat-row-last" : ""}`}
        key={cat.id}
      >
        {isSubcategory && (
          <div className="cat-tree-line">
            <span className={`cat-tree-connector ${isLast ? "last" : ""}`} />
          </div>
        )}
        <div className="cat-row-main">
          <span className="cat-row-icon">{getCategoryIcon(cat.icon, isSubcategory ? 18 : 22)}</span>
          <span className="cat-row-name">{getCategoryName(cat as CategoryWithSubs)}</span>
          {cat.isDefault && (
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
        <div className="cat-row-actions">
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
                onClick={() => openModal("edit", { id: cat.id, name: cat.name, icon: cat.icon })}
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
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <div className="title-with-icon">
            <div className="skeleton" style={{ width: 28, height: 28 }} />
            <h1 className="title">{t("categories.title")}</h1>
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
          <div className="cat-list">
            {userCategories.map((cat) => (
              <div key={cat.id} className="cat-group">
                {renderCategoryRow(cat)}
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <div className="cat-subs">
                    {cat.subcategories.map((sub, idx) => 
                      renderCategoryRow(sub, true, idx === cat.subcategories!.length - 1)
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="cat-section">
        <h2 className="cat-section-title">
          {lang === "es" ? "Categorías del sistema" : "System categories"}
        </h2>
        <div className="cat-list">
          {defaultCategories.map((cat) => (
            <div key={cat.id} className="cat-group">
              {renderCategoryRow(cat)}
              {cat.subcategories && cat.subcategories.length > 0 && (
                <div className="cat-subs">
                  {cat.subcategories.map((sub, idx) => 
                    renderCategoryRow(sub, true, idx === cat.subcategories!.length - 1)
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              {modalMode === "create"
                ? t("categories.add")
                : modalMode === "createSub"
                ? t("categories.addSub")
                : t("common.edit")}
            </h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>{lang === "es" ? "Icono" : "Icon"}</label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="icon-selector-btn"
                    onClick={() => setIconPickerOpen(!iconPickerOpen)}
                  >
                    {getCategoryIcon(formData.icon || "category", 24)}
                    <span>{lang === "es" ? "Seleccionar" : "Select"}</span>
                  </button>
                  {iconPickerOpen && (
                    <div className="icon-picker-dropdown">
                      {iconOptions.map((iconKey) => (
                        <button
                          key={iconKey}
                          type="button"
                          className={`icon-picker-item ${formData.icon === iconKey ? "selected" : ""}`}
                          onClick={() => {
                            setFormData({ ...formData, icon: iconKey });
                            setIconPickerOpen(false);
                          }}
                        >
                          {getCategoryIcon(iconKey, 20)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="field">
                <label htmlFor="cat-name">{t("settings.name")}</label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  placeholder={lang === "es" ? "Nombre de la categoría" : "Category name"}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={createCategory.isPending || updateCategory.isPending}
                >
                  {(createCategory.isPending || updateCategory.isPending) && (
                    <Spinner className="size-4 mr-2" />
                  )}
                  {modalMode === "edit" ? t("common.save") : lang === "es" ? "Crear" : "Create"}
                </button>
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
