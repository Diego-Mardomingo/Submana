import { NextRequest } from "next/server";
import { getAuthedClient, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { normalizeHandle, validateHandle } from "@/lib/handles";

/** Whether a @handle is free (the caller's own handle counts as available). */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const handle = normalizeHandle(request.nextUrl.searchParams.get("handle") ?? "");
  const error = validateHandle(handle);
  if (error) return jsonResponse({ data: { available: false, error } });

  const { data, error: rpcError } = await supabase.rpc("handle_available", { p_handle: handle });
  if (rpcError) return jsonServerError("profile/handle", rpcError);
  return jsonResponse({ data: data ? { available: true } : { available: false, error: "handle_taken" } });
}
