type TreeNode = { id: string; parent_id: string | null };

/** All descendants (children, grandchildren, ...) of `parentId`. */
export function getDescendantIds(categories: TreeNode[], parentId: string): string[] {
  const children = categories.filter((c) => c.parent_id === parentId).map((c) => c.id);
  return children.flatMap((id) => [id, ...getDescendantIds(categories, id)]);
}

/** System (user_id null) descendants of `parentId`. */
export function getSystemDescendantIds(categories: (TreeNode & { user_id: string | null })[], parentId: string): string[] {
  return getDescendantIds(categories.filter((c) => c.user_id === null), parentId);
}

/** Ancestor chain (parent, grandparent, ... up to root); stops on cycles. */
export function getAncestorIds(categories: TreeNode[], categoryId: string): string[] {
  const parentOf = new Map(categories.map((c) => [c.id, c.parent_id]));
  const ids: string[] = [];
  for (let parent = parentOf.get(categoryId); parent && !ids.includes(parent); parent = parentOf.get(parent)) ids.push(parent);
  return ids;
}
