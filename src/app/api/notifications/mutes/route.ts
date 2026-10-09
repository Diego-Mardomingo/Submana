import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import type { MuteTargetType } from "@/lib/notifications/types";
import { UUID } from "@/lib/shared/server";

function parseTarget(type: unknown, id: unknown): { type: MuteTargetType; id: string } | null {
  if ((type !== "group" && type !== "account") || typeof id !== "string" || !UUID.test(id)) return null;
  return { type, id };
}

/** Groups and accounts I silenced. */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase.from("notification_mutes").select("target_type, target_id, created_at").order("created_at", { ascending: false });
  if (error) return jsonServerError("notifications/mutes", error);
  return jsonCachedResponse({ data: data ?? [] });
}

/** Silence a group or an account (body: `{ target_type, target_id }`). Idempotent. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid JSON body");
  const target = parseTarget(body.target_type, body.target_id);
  if (!target) return jsonError("invalid_target");

  // Only things I can see: RLS hides the groups I am not in; accounts are checked explicitly.
  if (target.type === "group") {
    const { data } = await supabase.from("groups").select("id").eq("id", target.id).maybeSingle();
    if (!data) return jsonError("target_not_found", 404);
  } else if (!(await getAccountAccess(supabase, user.id, target.id))) {
    return jsonError("target_not_found", 404);
  }

  const { error } = await supabase
    .from("notification_mutes")
    .upsert({ user_id: user.id, target_type: target.type, target_id: target.id }, { onConflict: "user_id,target_type,target_id", ignoreDuplicates: true });
  if (error) return jsonServerError("notifications/mutes", error);
  return jsonResponse({ data: { target_type: target.type, target_id: target.id } }, 201);
}

/** Stop silencing (query: `?target_type=group&target_id=<uuid>`, or the same fields in a JSON body). */
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const query = request.nextUrl.searchParams;
  const body = query.has("target_type") ? null : await request.json().catch(() => null);
  const target = parseTarget(query.get("target_type") ?? body?.target_type, query.get("target_id") ?? body?.target_id);
  if (!target) return jsonError("invalid_target");

  const { error } = await supabase.from("notification_mutes").delete().eq("user_id", user.id).eq("target_type", target.type).eq("target_id", target.id);
  if (error) return jsonServerError("notifications/mutes", error);
  return jsonResponse({ data: { target_type: target.type, target_id: target.id } });
}
