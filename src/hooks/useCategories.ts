"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useLang } from "./useLang";
import { useOptimisticMutation } from "./useOptimisticMutation";

export interface CategoryItem {
  id: string;
  name: string;
  name_en?: string;
  emoji?: string | null;
  icon?: string;
  parent_id?: string | null;
  isDefault: boolean;
  exclude_from_metrics?: boolean;
}

export interface CategoryWithSubs extends CategoryItem {
  subcategories?: CategoryItem[];
}

interface CategoriesData {
  defaultCategories: CategoryWithSubs[];
  userCategories: CategoryWithSubs[];
}

function useCategoriesQuery(archived: boolean) {
  return useQuery<CategoriesData>({
    queryKey: queryKeys.categories.list({ archived }),
    queryFn: () => api(`/api/crud/categories${archived ? "?archived=true" : ""}`),
    staleTime: 15 * 60 * 1000,
  });
}

export const useCategories = () => useCategoriesQuery(false);
export const useArchivedCategories = () => useCategoriesQuery(true);

/** Localised names, icons and parent links of every active category. */
export function useCategoryLookup() {
  const lang = useLang();
  const { data, isLoading } = useCategories();
  const lookup = useMemo(() => {
    const name = new Map<string, string>();
    const icon = new Map<string, string>();
    const emoji = new Map<string, string>();
    const parent = new Map<string, string>();
    for (const root of [...(data?.defaultCategories ?? []), ...(data?.userCategories ?? [])]) {
      for (const cat of [root, ...(root.subcategories ?? [])]) {
        name.set(cat.id, lang === "en" && cat.name_en ? cat.name_en : cat.name);
        if (cat.emoji) emoji.set(cat.id, cat.emoji);
        const iconKey = cat.emoji ?? cat.icon;
        if (iconKey) icon.set(cat.id, iconKey);
        if (cat !== root) parent.set(cat.id, root.id);
      }
    }
    /** Top-level category of a transaction (its category, or the parent of its subcategory). */
    const rootOf = (tx: { category_id?: string | null; subcategory_id?: string | null }) =>
      tx.category_id ?? (tx.subcategory_id ? (parent.get(tx.subcategory_id) ?? tx.subcategory_id) : undefined);
    return { name, icon, emoji, parent, rootOf };
  }, [data, lang]);
  return { ...lookup, isLoading };
}

/** Mutation that optimistically edits the user categories of the active (or archived) list. */
function useCategoryMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  update: (list: CategoryWithSubs[], vars: TVars) => CategoryWithSubs[],
  { archived = false, silentError = false } = {}
) {
  return useOptimisticMutation<TVars, CategoriesData>({
    mutationFn,
    queryKey: queryKeys.categories.list({ archived }),
    update: (old, vars) => ({ ...old, userCategories: update(old.userCategories, vars) }),
    invalidate: [queryKeys.categories.all],
    meta: { silentError },
  });
}

const removeCategory = (list: CategoryWithSubs[], id: string) =>
  list
    .filter((cat) => cat.id !== id)
    .map((cat) => ({ ...cat, subcategories: cat.subcategories?.filter((sub) => sub.id !== id) }));

type CategoryInput = { name: string; parent_id?: string | null; emoji?: string | null };

export function useCreateCategory() {
  return useCategoryMutation(
    (input: CategoryInput) => api("/api/crud/categories", "POST", { ...input, emoji: input.emoji ?? undefined }),
    (list, input) => {
      const created: CategoryWithSubs = { ...input, id: `temp-${Date.now()}`, isDefault: false, subcategories: [] };
      if (!input.parent_id) return [...list, created];
      return list.map((cat) =>
        cat.id === input.parent_id ? { ...cat, subcategories: [...(cat.subcategories ?? []), created] } : cat
      );
    },
    { silentError: true } // the sheet shows the error inline
  );
}

export function useUpdateCategory() {
  return useCategoryMutation(
    ({ id, ...input }: { id: string; name: string; emoji?: string | null }) => api(`/api/crud/categories/${id}`, "PATCH", input),
    (list, { id, ...patch }) =>
      list.map((cat) =>
        cat.id === id
          ? { ...cat, ...patch }
          : { ...cat, subcategories: cat.subcategories?.map((sub) => (sub.id === id ? { ...sub, ...patch } : sub)) }
      ),
    { silentError: true }
  );
}

export function useDeleteCategory() {
  return useCategoryMutation((id: string) => api(`/api/crud/categories/${id}`, "DELETE"), removeCategory);
}

export function useArchiveCategory() {
  return useCategoryMutation(
    ({ id, archiveChildren = true }: { id: string; archiveChildren?: boolean }) =>
      api(`/api/crud/categories/${id}/archive`, "POST", { archive_children: archiveChildren }),
    (list, { id }) => removeCategory(list, id)
  );
}

export function useUnarchiveCategory() {
  return useCategoryMutation((id: string) => api(`/api/crud/categories/${id}/unarchive`, "POST"), removeCategory, { archived: true });
}
