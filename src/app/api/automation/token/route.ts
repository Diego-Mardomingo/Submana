import { randomBytes } from "crypto";
import { getAuthedClient, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { hashToken } from "@/lib/supabase/admin";

export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data } = await supabase.from("api_tokens").select("created_at, last_used_at").eq("user_id", user.id).limit(1).maybeSingle();
  return jsonResponse({ data: { hasToken: !!data, createdAt: data?.created_at ?? null, lastUsedAt: data?.last_used_at ?? null } });
}

/** Creates or rotates the user's automation token; the plain token is only returned once. */
export async function POST() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const limited = await enforceRateLimit(`token-rotation:${user.id}`, RATE_LIMITS.tokenRotation.limit, RATE_LIMITS.tokenRotation.windowSeconds);
  if (limited) return limited;

  const token = randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  const { data: existing } = await supabase.from("api_tokens").select("id").eq("user_id", user.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("api_tokens").update({ token_hash: hashToken(token), created_at: createdAt, last_used_at: null }).eq("id", existing.id)
    : await supabase.from("api_tokens").insert({ user_id: user.id, token_hash: hashToken(token), name: "Automation" });
  if (error) return jsonServerError("automation/token", error);
  return jsonResponse({ data: { token, createdAt } }, 201);
}

/** Revokes the token: automations using it stop working. */
export async function DELETE() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { error } = await supabase.from("api_tokens").delete().eq("user_id", user.id);
  if (error) return jsonServerError("automation/token", error);
  return jsonResponse({ data: { success: true } });
}
