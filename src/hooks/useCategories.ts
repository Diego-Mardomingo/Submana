"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export interface CategoryItem {
  id: string;
  name: string;
  name_en?: string;
  emoji?: string | null;
  icon?: string;
  parent_id?: string | null;
  isDefault: boolean;
}

export interface CategoryWithSubs extends CategoryItem {
  subcategories?: CategoryItem[];
}

interface CategoriesData {
  defaultCategories: CategoryWithSubs[];
  userCategories: CategoryWithSubs[];
}

async function fetchCategories(archived = false): Promise<CategoriesData> {
  const url = archived ? "/api/crud/categories?archived=true" : "/api/crud/categories";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch categories");
  const json = await res.json();
  return json.data ?? { defaultCategories: [], userCategories: [] };
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.list({ archived: false }),
    queryFn: () => fetchCategories(false),
  });
}

export function useArchivedCategories() {
  return useQuery({
    queryKey: queryKeys.categories.list({ archived: true }),
    queryFn: () => fetchCategories(true),
  });
}
