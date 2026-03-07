import type { CategoryWithSubs, CategoryItem } from "@/hooks/useCategories";

/** IDs de categorías (o subcategorías) que excluyen transacciones de métricas */
function getExcludedFromMetricsIds(categories: CategoryWithSubs[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: (CategoryWithSubs | CategoryItem)[]) => {
    for (const c of list) {
      if (c.exclude_from_metrics) ids.add(c.id);
      const subs = (c as CategoryWithSubs).subcategories;
      if (subs?.length) walk(subs);
    }
  };
  walk(categories);
  return ids;
}

/** Map de subcategory_id -> parent category_id */
function getSubToParent(categories: CategoryWithSubs[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of categories) {
    for (const s of p.subcategories ?? []) {
      m.set(s.id, p.id);
    }
  }
  return m;
}

export interface MetricsFilterContext {
  defaultCategories: CategoryWithSubs[];
  userCategories: CategoryWithSubs[];
}

/**
 * Devuelve true si la transacción NO debe contarse en métricas.
 * Usar para filtrar antes de sumar/contar en dashboard, resúmenes y presupuestos.
 */
export function shouldExcludeFromMetrics(
  tx: { category_id?: string | null; subcategory_id?: string | null },
  context: MetricsFilterContext
): boolean {
  const excludedIds = getExcludedFromMetricsIds([
    ...context.defaultCategories,
    ...context.userCategories,
  ]);
  if (excludedIds.size === 0) return false;

  const catId = tx.category_id ?? (tx.subcategory_id
    ? getSubToParent([...context.defaultCategories, ...context.userCategories]).get(tx.subcategory_id)
    : undefined)
    ?? tx.subcategory_id;

  return catId ? excludedIds.has(catId) : false;
}

/**
 * Filtra transacciones excluyendo las que tienen categoría marcada para no contar en métricas.
 */
export function filterForMetrics<T extends { category_id?: string | null; subcategory_id?: string | null }>(
  transactions: T[],
  context: MetricsFilterContext
): T[] {
  return transactions.filter((tx) => !shouldExcludeFromMetrics(tx, context));
}
