
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
    const name = formData.get("name")?.toString();
    const balanceInput = formData.get("balance")?.toString();
    const balance = balanceInput ? parseFloat(balanceInput) : 0;
    const icon = formData.get("icon")?.toString();
    const color = formData.get("color")?.toString();

    if (!name || isNaN(balance)) {
        return redirect("/accounts?error=missing_fields");
    }

    try {
        const { error } = await supabase.from("accounts").insert({
            user_id: user.id,
            name,
            balance,
            icon,
            color
        });

        if (error) {
            console.error("Supabase error creating account:", error);
            return redirect(`/accounts?error=${encodeURIComponent(error.message)}`);
        }
    } catch (err) {
        console.error("Unexpected error creating account:", err);
        return redirect("/accounts?error=unexpected_error");
    }

    return redirect("/accounts?success=account_created");
};
