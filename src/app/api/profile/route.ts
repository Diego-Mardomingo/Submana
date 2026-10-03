import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { normalizeHandle, validateHandle } from "@/lib/handles";

const PROFILE_COLUMNS = "user_id, handle, display_name, avatar_url, created_at, updated_at";

/** Own profile, or null when the user hasn't picked a @handle yet. */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle();
  if (error) return jsonServerError("profile", error);
  return jsonCachedResponse({ data: data ?? null });
}

/** Create or update the own profile. The avatar always comes from the Google session, never from the client. */
export async function PUT(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid JSON body");
  const handle = normalizeHandle(String(body.handle ?? ""));
  const displayName = String(body.display_name ?? "").trim();
  const handleError = validateHandle(handle);
  if (handleError) return jsonError(handleError);
  if (displayName.length < 1 || displayName.length > 60) return jsonError("display_name_invalid");

  const metaAvatar = user.user_metadata?.avatar_url;
  const avatarUrl = typeof metaAvatar === "string" && /^https:\/\//.test(metaAvatar) ? metaAvatar : null;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: user.id, handle, display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select(PROFILE_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") return jsonError("handle_taken", 409);
    return jsonServerError("profile", error);
  }
  return jsonResponse({ data });
}
