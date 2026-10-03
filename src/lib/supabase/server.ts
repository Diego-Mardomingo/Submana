import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookies are read-only in Server Components.
        }
      },
    },
  });
}

/** Row of `table` owned by the signed-in user (server pages); redirects to login or 404s. */
export async function getOwnedRow<T>(table: string, id: string): Promise<T> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data } = await supabase.from(table).select("*").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (!data) notFound();
  return data as T;
}

/**
 * Account the signed-in user owns or belongs to (accepted member of a joint account), with their role
 * (server pages); redirects to login or 404s.
 */
export async function getAccessibleAccount<T extends { user_id?: string; is_joint?: boolean }>(id: string): Promise<T & { my_role: "owner" | "member" }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  if (data.user_id === auth.user.id) return { ...(data as T), my_role: "owner" };
  const { data: member } = data.is_joint
    ? await supabase.from("account_members").select("user_id").eq("account_id", id).eq("user_id", auth.user.id).eq("status", "accepted").maybeSingle()
    : { data: null };
  if (!member) notFound();
  return { ...(data as T), my_role: "member" };
}
