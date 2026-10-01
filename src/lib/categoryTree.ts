type TreeNode = { id: string; parent_id: string | null };

/** All descendants (children, grandchildren, ...) of `parentId`. */
export function getDescendantIds(categories: TreeNode[], parentId: string): string[] {
  const children = categories.filter((c) => c.parent_id === parentId).map((c) => c.id);
  return children.flatMap((id) => [id, ...getDescendantIds(categories, id)]);
}

/** Ancestor chain (parent, grandparent, ... up to root). */
export function getAncestorIds(categories: TreeNode[], categoryId: string): string[] {
  const parent = categories.find((c) => c.id === categoryId)?.parent_id;
  return parent ? [parent, ...getAncestorIds(categories, parent)] : [];
}
