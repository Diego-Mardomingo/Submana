export type AccountRole = "owner" | "member";

export type AccountField = "name" | "color" | "icon" | "bank_provider" | "balance" | "is_default" | "display_order" | "is_joint" | "members" | "delete" | "bulk_delete";

const MEMBER_FIELDS: ReadonlySet<AccountField> = new Set(["name", "color", "icon", "bank_provider", "balance"]);

/**
 * What a role may change on an account. Members of a joint account can edit its presentation and
 * balance (and add/edit transactions); ownership, default flag, ordering, membership and deletion
 * belong to the owner. Mirrors the accounts_guard_update trigger.
 */
export function canEditAccount(role: AccountRole | null | undefined, field: AccountField): boolean {
  if (role === "owner") return true;
  return role === "member" && MEMBER_FIELDS.has(field);
}
