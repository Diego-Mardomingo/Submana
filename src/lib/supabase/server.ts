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
