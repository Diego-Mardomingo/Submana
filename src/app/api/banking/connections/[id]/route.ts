import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { removeConnection } from "@/lib/banking/connections";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

/** Disconnects: closes the bank session and forgets the connection (imported movements stay). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user } = await getAuthedClient();
  if (!user) return unauthorized();
  try {
    if (!(await removeConnection(createAdminClient(), user.id, id))) return jsonError("connection_not_found", 404);
    return jsonResponse({ data: { success: true } });
  } catch (error) {
    return jsonServerError("banking/connections/[id]", error);
  }
}
