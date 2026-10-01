type CategoryNode = { id: string; parent_id: string | null; user_id: string | null };

/** Descendientes del sistema (hijos, nietos…) de una categoría. */
export function getSystemDescendantIds(categories: CategoryNode[], parentId: string): string[] {
  const ids: string[] = [];
  const queue = [parentId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const c of categories) {
      if (c.parent_id === id && c.user_id === null) {
        ids.push(c.id);
        queue.push(c.id);
      }
    }
  }
  return ids;
}

/** Cadena de ancestros (padre, abuelo… hasta la raíz) de una categoría. */
export function getAncestorIds(
  categories: { id: string; parent_id: string | null }[],
  categoryId: string
): string[] {
  const ids: string[] = [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  let currentId: string | null = categoryId;
  while (currentId) {
    const cat = byId.get(currentId);
    if (!cat?.parent_id || ids.includes(cat.parent_id)) break;
    ids.push(cat.parent_id);
    currentId = cat.parent_id;
  }
  return ids;
}
