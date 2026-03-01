"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { CategoryWithSubs, CategoryItem } from "./useCategories";

interface CategoriesData {
  defaultCategories: CategoryWithSubs[];
  userCategories: CategoryWithSubs[];
}

interface CreateCategoryInput {
  name: string;
  parent_id?: string | null;
  emoji?: string | null;
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const res = await fetch("/api/crud/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          emoji: input.emoji ?? undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to create category");
      return json.data;
    },

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.lists() });
      const queryKey = queryKeys.categories.list({ archived: false });
      const previous = queryClient.getQueryData<CategoriesData>(queryKey);

      const optimisticCategory: CategoryWithSubs = {
        id: `temp-${Date.now()}`,
        name: input.name,
        emoji: input.emoji,
        parent_id: input.parent_id,
        isDefault: false,
        subcategories: [],
      };

      queryClient.setQueryData<CategoriesData>(queryKey, (old) => {
        if (!old) return old;
        if (input.parent_id) {
          return {
            ...old,
            userCategories: old.userCategories.map((cat) =>
              cat.id === input.parent_id
                ? { ...cat, subcategories: [...(cat.subcategories ?? []), optimisticCategory] }
                : cat
            ),
          };
        }
        return {
          ...old,
          userCategories: [...old.userCategories, optimisticCategory],
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories.list({ archived: false }), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

interface UpdateCategoryInput {
  id: string;
  name: string;
  emoji?: string | null;
}

function updateCategoryInList(
  categories: CategoryWithSubs[],
  id: string,
  updates: Partial<CategoryItem>
): CategoryWithSubs[] {
  return categories.map((cat) => {
    if (cat.id === id) {
      return { ...cat, ...updates };
    }
    if (cat.subcategories?.length) {
      return {
        ...cat,
        subcategories: cat.subcategories.map((sub) =>
          sub.id === id ? { ...sub, ...updates } : sub
        ),
      };
    }
    return cat;
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, emoji }: UpdateCategoryInput) => {
      const res = await fetch(`/api/crud/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update category");
      return json.data;
    },

    onMutate: async ({ id, name, emoji }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.lists() });
      const queryKey = queryKeys.categories.list({ archived: false });
      const previous = queryClient.getQueryData<CategoriesData>(queryKey);

      queryClient.setQueryData<CategoriesData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          userCategories: updateCategoryInList(old.userCategories, id, { name, emoji }),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories.list({ archived: false }), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

function removeCategoryFromList(categories: CategoryWithSubs[], id: string): CategoryWithSubs[] {
  return categories
    .filter((cat) => cat.id !== id)
    .map((cat) => ({
      ...cat,
      subcategories: cat.subcategories?.filter((sub) => sub.id !== id),
    }));
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crud/categories/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete category");
      return json.data;
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.lists() });
      const queryKey = queryKeys.categories.list({ archived: false });
      const previous = queryClient.getQueryData<CategoriesData>(queryKey);

      queryClient.setQueryData<CategoriesData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          userCategories: removeCategoryFromList(old.userCategories, id),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories.list({ archived: false }), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useArchiveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archiveChildren = true }: { id: string; archiveChildren?: boolean }) => {
      const res = await fetch(`/api/crud/categories/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive_children: archiveChildren }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to archive");
      return json.data;
    },

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.lists() });
      const activeKey = queryKeys.categories.list({ archived: false });
      const previous = queryClient.getQueryData<CategoriesData>(activeKey);

      queryClient.setQueryData<CategoriesData>(activeKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          userCategories: removeCategoryFromList(old.userCategories, id),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories.list({ archived: false }), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useUnarchiveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crud/categories/${id}/unarchive`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to unarchive");
      return json.data;
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.lists() });
      const archivedKey = queryKeys.categories.list({ archived: true });
      const previous = queryClient.getQueryData<CategoriesData>(archivedKey);

      queryClient.setQueryData<CategoriesData>(archivedKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          userCategories: removeCategoryFromList(old.userCategories, id),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories.list({ archived: true }), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}
