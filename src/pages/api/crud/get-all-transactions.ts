
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

    const yearParam = url.searchParams.get('year');
    const monthParam = url.searchParams.get('month');

    let query = supabase
        .from("transactions")
        .select(`
      *,
      account:accounts(name, color),
      category:categories!category_id(name),
      subcategory:categories!subcategory_id(name)
    `)
        .eq("user_id", user.id)
        .order("date", { ascending: false });

    if (yearParam && monthParam) {
        const year = parseInt(yearParam);
        const month = parseInt(monthParam); // 0-indexed (0 = Jan)

        // Start date: 1st of the month
        const startDate = new Date(year, month, 1).toISOString();

        // End date: Last day of the month
        // new Date(year, month + 1, 0) gives the last day of the current month
        const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data: transactions, error } = await query;

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ transactions }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
