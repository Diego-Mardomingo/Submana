"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export interface CategoryItem {
  id: string;
  name: string;
  name_en?: string;
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

async function fetchCategories(): Promise<CategoriesData> {
  const res = await fetch("/api/crud/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  const json = await res.json();
  return json.data ?? { defaultCategories: [], userCategories: [] };
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.lists(),
    queryFn: fetchCategories,
  });
}
