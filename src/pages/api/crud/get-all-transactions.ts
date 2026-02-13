
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const GET: APIRoute = async ({ cookies, url }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken.value);

    if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Optional: Filter by month/year if needed later
    // const month = url.searchParams.get('month');
    // const year = url.searchParams.get('year');

    const { data: transactions, error } = await supabase
        .from("transactions")
        .select(`
      *,
      account:accounts(name),
      category:categories(name, type, parent_id)
    `)
        .eq("user_id", user.id)
        .order("date", { ascending: false });

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ transactions }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
