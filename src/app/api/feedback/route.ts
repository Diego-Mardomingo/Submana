import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await parseRequestBody(request);
  const message = (body.message || "").trim();
  if (body.type !== "error" && body.type !== "suggestion") return jsonError("type must be 'error' or 'suggestion'");
  if (!message) return jsonError("message is required");

  const { data, error } = await supabase.from("feedback").insert({ user_id: user.id, type: body.type, message }).select().single();
  if (error) return jsonServerError("feedback", error);
  return jsonResponse({ data }, 201);
}
