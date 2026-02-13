
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
        return redirect("/login");
    }

    let { data: session, error: authError } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
    });

    if (authError || !session.user) {
        return redirect("/login");
    }

    const user = session.user;

    const formData = await request.formData();
    const id = formData.get("id")?.toString();
    const name = formData.get("name")?.toString();
    const balance = parseFloat(formData.get("balance")?.toString() || "0");
    const icon = formData.get("icon")?.toString();
    const color = formData.get("color")?.toString();

    if (!id || !name) {
        const referer = request.headers.get("referer") || "/accounts";
        return redirect(`${referer}?error=missing_fields`);
    }

    // NOTE: Updating balance directly here overrides calculated balance from transactions.
    // Ideally balance should be calculated or this is an "initial balance" update.
    // For simplicity, we allow updating it.

    const { error } = await supabase
        .from("accounts")
        .update({ name, balance, icon, color })
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        const referer = request.headers.get("referer") || "/accounts";
        return redirect(`${referer}?error=${error.message}`);
    }

    return redirect("/accounts?success=account_updated");
};
