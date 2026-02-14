import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useCategories } from "../hooks/useCategories";
import { ui } from "../i18n/ui";
import ShowToast from "./ShowToast";
import "../styles/CategoriesBody.css";

export default function CategoriesBody(props) {
    return (
        <QueryClientProvider client={queryClient}>
            <CategoriesBodyInner {...props} />
            <ShowToast />
        </QueryClientProvider>
    );
}

function CategoriesBodyInner({ lang }) {
    const t = (key) => ui[lang]?.[key] || ui['en'][key];
    const { data: categories, isLoading } = useCategories();

    // API returns structured categories: parent with subcategories array
    const parents = categories || [];

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        parent_id: ''
    });

    // Delete Modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const openModal = (mode, data = {}) => {
        setIsModalOpen(true);
        setModalMode(mode);
        setFormData({
            id: data.id || '',
            name: data.name || '',
            parent_id: data.parentId || ''
        });
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFormData({ id: '', name: '', parent_id: '' });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const endpoint = modalMode === 'create' ? '/api/crud/create-category' : '/api/crud/update-category';
        const body = new URLSearchParams();
        if (formData.id) body.append('id', formData.id);
        if (formData.name) body.append('name', formData.name);
        if (formData.parent_id) body.append('parent_id', formData.parent_id);

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                body: body
            });
            if (res.ok || res.status === 303) {
                await queryClient.invalidateQueries({ queryKey: ['categories'] });
                closeModal();
            } else {
                console.error("Failed to save category");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const openDeleteModal = (id) => {
        setCategoryToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setCategoryToDelete(null);
    };

    const handleDelete = async (e) => {
        e.preventDefault();
        if (!categoryToDelete) return;
        setIsDeleting(true);

        try {
            const res = await fetch('/api/crud/delete-category', {
                method: 'POST',
                body: new URLSearchParams({ id: categoryToDelete })
            });

            if (res.ok || res.status === 303) {
                await queryClient.invalidateQueries({ queryKey: ['categories'] });
                closeDeleteModal();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return <CategoriesSkeleton t={t} />;
    }

    return (
        <div className="page-container fade-in">
            <header className="page-header">
                <h1 className="title">{t('categories.title')}</h1>
                <button className="add-btn" onClick={() => openModal('create')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    {t('categories.add')}
                </button>
            </header>

            <div className="categories-list">
                {parents.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16"></path><path d="M4 15h16"></path><path d="M10 3L8 21"></path><path d="M16 3l-2 18"></path></svg>
                        </div>
                        <p>{t('categories.noCategories')}</p>
                    </div>
                ) : (
                    parents.map(cat => (
                        <div className="category-card" key={cat.id} data-id={cat.id}>
                            <div className="category-header">
                                <span className="cat-name">{cat.name}</span>
                                <div className="cat-actions">
                                    <button className="icon-btn edit-btn" onClick={() => openModal('edit', { id: cat.id, name: cat.name })} aria-label="Edit">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button className="icon-btn delete-btn" onClick={() => openDeleteModal(cat.id)} aria-label="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="subcategories">
                                {cat.subcategories && cat.subcategories.map(sub => (
                                    <div className="subcategory-item" key={sub.id}>
                                        <span>{sub.name}</span>
                                        <div className="sub-actions">
                                            <button className="icon-btn xs edit-btn" onClick={() => openModal('edit', { id: sub.id, name: sub.name, parentId: cat.id })}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            <button className="icon-btn xs delete-btn" onClick={() => openDeleteModal(sub.id)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button className="add-sub-btn" onClick={() => openModal('create', { parentId: cat.id })}>
                                    + {t('categories.addSub')}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h2>
                            {modalMode === 'edit'
                                ? (lang === 'es' ? 'Editar Categoría' : 'Edit Category')
                                : (formData.parent_id
                                    ? (lang === 'es' ? 'Añadir Subcategoría' : 'Add Subcategory')
                                    : (lang === 'es' ? 'Añadir Categoría' : 'Add Category'))
                            }
                        </h2>
                        <form onSubmit={handleSave}>
                            <div className="field">
                                <label htmlFor="cat-name">{t('settings.name')}</label>
                                <input
                                    type="text"
                                    id="cat-name"
                                    required
                                    placeholder="Ex. Transport"
                                    autoComplete="off"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={closeModal}>{t('common.cancel')}</button>
                                <button type="submit" className={`btn-save ${isSaving ? 'btn-loading' : ''}`}>{t('common.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content delete-confirm">
                        <div className="delete-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <h2>{t('common.areYouSure') || 'Are you sure?'}</h2>
                        <p>{t('categories.deleteConfirm') || 'This action will delete the category.'}</p>

                        <div className="modal-actions full-width">
                            <button type="button" className="btn-cancel" onClick={closeDeleteModal}>{t('common.cancel')}</button>
                            <button type="button" className={`btn-delete-final ${isDeleting ? 'btn-loading' : ''}`} onClick={handleDelete}>{t('common.delete') || 'Delete'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CategoriesSkeleton({ t }) {
    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="title">{t('categories.title')}</h1>
                <div className="skeleton-btn" style={{ width: '100px', height: '40px', borderRadius: '8px', background: 'var(--gris-oscuro)' }}></div>
            </header>
            <div className="categories-list">
                {[1, 2, 3].map(i => (
                    <div className="skeleton" key={i} style={{ height: '100px', borderRadius: '12px', background: 'var(--gris-oscuro)', marginBottom: '1rem' }}></div>
                ))}
            </div>
        </div>
    );
}
