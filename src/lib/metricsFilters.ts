import type { CategoryWithSubs, CategoryItem } from "@/hooks/useCategories";

export interface MetricsFilterContext {
  defaultCategories: CategoryWithSubs[];
  userCategories: CategoryWithSubs[];
}

type TxCategories = { category_id?: string | null; subcategory_id?: string | null };

/** Conjunto de excluidas y mapa subcategoría→padre, calculados una vez por contexto. */
function buildExclusionIndex(context: MetricsFilterContext) {
  const excludedIds = new Set<string>();
  const subToParent = new Map<string, string>();
  const walk = (list: (CategoryWithSubs | CategoryItem)[], parentId?: string) => {
    for (const c of list) {
      if (c.exclude_from_metrics) excludedIds.add(c.id);
      if (parentId) subToParent.set(c.id, parentId);
      const subs = (c as CategoryWithSubs).subcategories;
      if (subs?.length) walk(subs, c.id);
    }
  };
  walk([...context.defaultCategories, ...context.userCategories]);

  return (tx: TxCategories): boolean => {
    if (excludedIds.size === 0) return false;
    const catId =
      tx.category_id ?? (tx.subcategory_id ? subToParent.get(tx.subcategory_id) : undefined) ?? tx.subcategory_id;
    return catId ? excludedIds.has(catId) : false;
  };
}

/**
 * Devuelve true si la transacción NO debe contarse en métricas.
 * Para listas usar filterForMetrics, que construye el índice una sola vez.
 */
export function shouldExcludeFromMetrics(tx: TxCategories, context: MetricsFilterContext): boolean {
  return buildExclusionIndex(context)(tx);
}

/**
 * Filtra transacciones excluyendo las que tienen categoría marcada para no contar en métricas.
 */
export function filterForMetrics<T extends TxCategories>(
  transactions: T[],
  context: MetricsFilterContext
): T[] {
  const isExcluded = buildExclusionIndex(context);
  return transactions.filter((tx) => !isExcluded(tx));
}
