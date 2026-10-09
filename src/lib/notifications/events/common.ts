/** Helpers shared by the per-domain event builders (server only, service role, never throw). */
import { createAdminClient } from "@/lib/supabase/admin";

export interface ProfileInfo {
  /** Display name, or the handle when there is none. Empty when the profile is unknown (the catalog then says "Someone"). */
  name: string;
  handle: string;
}

/** Display names and handles of users (the author of an action is not always visible through the caller's RLS). */
export async function loadProfiles(ids: readonly string[]): Promise<Map<string, ProfileInfo>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, ProfileInfo>();
  if (unique.length === 0) return result;
  try {
    const { data, error } = await createAdminClient().from("profiles").select("user_id, handle, display_name").in("user_id", unique);
    if (error) throw error;
    for (const row of data ?? []) result.set(row.user_id as string, { name: (row.display_name as string) || (row.handle as string) || "", handle: (row.handle as string) ?? "" });
  } catch (error) {
    console.error("[notifications] loadProfiles", error);
  }
  return result;
}

export async function loadProfile(id: string): Promise<ProfileInfo> {
  return (await loadProfiles([id])).get(id) ?? { name: "", handle: "" };
}

/** Euros as a plain number from a Postgres numeric (string or number). */
export const euros = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;

export const toCents = (value: unknown) => Math.round((Number(value) || 0) * 100);
