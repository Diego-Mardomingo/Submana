import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { expenseDeletedEvents, loadExpense } from "@/lib/notifications/events/subcount";
import { notifyAfter } from "@/lib/notifications/server";
import { saveSharedExpense } from "@/lib/shared/saveExpense";
import { limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";

type Params = { params: Promise<{ id: string }> };

/** Any member can edit a shared expense. Other members' bank amounts are never touched. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return saveSharedExpense(request, id);
}

/** Any member can delete: virtual rows disappear, linked bank rows are unlinked. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("expense_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  // The soft delete keeps the shares, but read who took part before the RPC anyway.
  const before = await loadExpense(id);
  const { error } = await supabase.rpc("delete_shared_expense", { p_expense_id: id });
  if (error) return rpcErrorResponse("shared/expenses/[id]", error);
  notifyAfter(() => expenseDeletedEvents(before, user.id));
  return jsonResponse({ data: { success: true } });
}
