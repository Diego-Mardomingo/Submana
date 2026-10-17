import { getAuthedClient, jsonCachedResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { listConnections } from "@/lib/banking/connections";
import { createAdminClient } from "@/lib/supabase/admin";

/** The user's bank connections with their account links (no secrets). */
export async function GET() {
  const { user } = await getAuthedClient();
  if (!user) return unauthorized();
  try {
    return jsonCachedResponse({ data: await listConnections(createAdminClient(), user.id) });
  } catch (error) {
    return jsonServerError("banking/connections", error);
  }
}
