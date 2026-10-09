import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { UUID } from "@/lib/shared/server";

type Params = { params: Promise<{ id: string }> };

/** Mark one notification as read (`{ read: true }`) or unread (`{ read: false }`). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("notification_not_found", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.read !== "boolean") return jsonError("Invalid JSON body");

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: body.read ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id, read_at");
  if (error) return jsonServerError("notifications/[id]", error);
  if (!data?.length) return jsonError("notification_not_found", 404);
  return jsonResponse({ data: data[0] });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("notification_not_found", 404);

  const { data, error } = await supabase.from("notifications").delete().eq("id", id).select("id");
  if (error) return jsonServerError("notifications/[id]", error);
  if (!data?.length) return jsonError("notification_not_found", 404);
  return jsonResponse({ data: { id } });
}
