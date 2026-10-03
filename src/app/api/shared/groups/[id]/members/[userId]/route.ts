import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";

type Params = { params: Promise<{ id: string; userId: string }> };

/** Leave a group or remove a member; blocked (member_has_balance) while their net balance is not zero. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, userId } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id) || !UUID.test(userId)) return jsonError("member_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const { error } = await supabase.rpc("remove_group_member", { p_group_id: id, p_user_id: userId });
  if (error) return rpcErrorResponse("shared/groups/members", error);
  return jsonResponse({ data: { success: true } });
}
