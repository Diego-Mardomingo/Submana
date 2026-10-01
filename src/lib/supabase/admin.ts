import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/**
 * Service-role client (bypasses RLS). Only for API routes that authenticate by other means
 * (e.g. Bearer token). Never expose it to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey);
}
