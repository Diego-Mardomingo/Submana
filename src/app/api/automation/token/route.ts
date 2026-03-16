import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
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
    .select("id, created_at")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return jsonResponse(
    {
      hasToken: !!existing,
      createdAt: existing?.created_at ?? null,
    },
    200
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

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
      .update({ token_hash: tokenHash, created_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (updateError) {
      return jsonError(updateError.message, 500);
    }
  } else {
    const { error: insertError } = await supabase.from("api_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      name: "Automation",
    });

    if (insertError) {
      return jsonError(insertError.message, 500);
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
