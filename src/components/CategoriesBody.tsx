"use client";

import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/useCategoryMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

type CategoryWithSubs = {
  id: string;
  name: string;
  subcategories?: Array<{ id: string; name: string }>;
};

export default function CategoriesBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState({ id: "", name: "", parent_id: "" });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const parents = (categories as CategoryWithSubs[]) || [];

  const openModal = (mode: "create" | "edit", data?: { id: string; name: string; parentId?: string }) => {
    setIsModalOpen(true);
    setModalMode(mode);
    setFormData({
      id: data?.id || "",
      name: data?.name || "",
      parent_id: data?.parentId || "",
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ id: "", name: "", parent_id: "" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    if (modalMode === "create") {
      await createCategory.mutateAsync({
        name: formData.name,
        parent_id: formData.parent_id || null,
      });
    } else if (formData.id) {
      await updateCategory.mutateAsync({ id: formData.id, name: formData.name });
    }
    closeModal();
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToDelete) return;
    await deleteCategory.mutateAsync(categoryToDelete);
    setDeleteModalOpen(false);
    setCategoryToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1 className="title">{t("categories.title")}</h1>
        </header>
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <h1 className="title">{t("categories.title")}</h1>
        <button type="button" className="add-btn" onClick={() => openModal("create")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("categories.add")}
        </button>
      </header>
      <div className="categories-list">
        {parents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M4 9h16" />
                <path d="M4 15h16" />
                <path d="M10 3L8 21" />
                <path d="M16 3l-2 18" />
              </svg>
            </div>
            <p>{t("categories.noCategories")}</p>
          </div>
        ) : (
          parents.map((cat) => (
            <div className="category-card" key={cat.id}>
              <div className="category-header">
                <span className="cat-name">{cat.name}</span>
                <div className="cat-actions">
                  <button type="button" className="icon-btn edit-btn" onClick={() => openModal("edit", { id: cat.id, name: cat.name })} aria-label="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button type="button" className="icon-btn delete-btn" onClick={() => { setCategoryToDelete(cat.id); setDeleteModalOpen(true); }} aria-label="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              {cat.subcategories?.map((sub) => (
                <div className="subcategory-item" key={sub.id}>{sub.name}</div>
              ))}
            </div>
          ))
        )}
      </div>
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{modalMode === "create" ? t("categories.add") : t("common.edit")}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label htmlFor="cat-name">{t("settings.name")}</label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              {modalMode === "create" && (
                <div className="field">
                  <label>{t("common.category")} (parent)</label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  >
                    <option value="">—</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>{t("common.cancel")}</button>
                <button type="submit" className="btn-save" disabled={createCategory.isPending || updateCategory.isPending}>{t("common.save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content delete-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{t("common.areYouSure")}</h2>
            <p>{t("accounts.deleteConfirm")}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setDeleteModalOpen(false)}>{t("common.cancel")}</button>
              <button type="button" className="btn-delete-final" onClick={handleDelete} disabled={deleteCategory.isPending}>{t("common.delete")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
