import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";

type Params = { params: Promise<{ id: string; userId: string }> };

/** A member leaves (userId = me) or the owner removes a member (also cancels a pending invitation). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, userId } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id) || !UUID.test(userId)) return jsonError("member_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const { error } =
    userId === user.id
      ? await supabase.rpc("leave_account", { p_account: id })
      : await supabase.rpc("remove_account_member", { p_account: id, p_user: userId });
  if (error) return rpcErrorResponse("accounts/members", error);
  return jsonResponse({ data: { success: true } });
}
