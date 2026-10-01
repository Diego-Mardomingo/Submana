import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, jsonServerError } from "@/lib/apiHelpers";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { createHash, randomBytes } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { data: existing } = await supabase
    .from("api_tokens")
    .select("id, created_at, last_used_at")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return jsonResponse(
    {
      hasToken: !!existing,
      createdAt: existing?.created_at ?? null,
      lastUsedAt: existing?.last_used_at ?? null,
    },
    200
  );
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const limited = await enforceRateLimit(
    `token-rotation:${user.id}`,
    RATE_LIMITS.tokenRotation.limit,
    RATE_LIMITS.tokenRotation.windowSeconds
  );
  if (limited) return limited;

  const plainToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(plainToken);

  const { data: existing } = await supabase
    .from("api_tokens")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from("api_tokens")
      .update({ token_hash: tokenHash, created_at: new Date().toISOString(), last_used_at: null })
      .eq("id", existing.id);

    if (updateError) {
      return jsonServerError("POST /api/automation/token", updateError);
    }
  } else {
    const { error: insertError } = await supabase.from("api_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      name: "Automation",
    });

    if (insertError) {
      return jsonServerError("POST /api/automation/token", insertError);
    }
  }

  return jsonResponse(
    {
      token: plainToken,
      createdAt: new Date().toISOString(),
      message: "Token only shown once; copy it now.",
    },
    201
  );
}

/** Revoca el token: las automatizaciones que lo usen dejan de funcionar. */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { error } = await supabase.from("api_tokens").delete().eq("user_id", user.id);
  if (error) {
    return jsonServerError("DELETE /api/automation/token", error);
  }

  return jsonResponse({ data: { success: true } });
}
