
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
        return redirect("/login");
    }

    const { data: sessionData, error: authError } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
    });

    if (authError || !sessionData.user) {
        return redirect("/login");
    }

    // Update cookies if session was refreshed
    if (sessionData.session && sessionData.session.access_token !== accessToken.value) {
        cookies.set("sb-access-token", sessionData.session.access_token, { path: "/" });
        cookies.set("sb-refresh-token", sessionData.session.refresh_token, { path: "/" });
    }

    const user = sessionData.user;

    const formData = await request.formData();
    const amountStr = formData.get("amount")?.toString() || "";
    const amount = parseFloat(amountStr);
    const type = formData.get("type")?.toString(); // income, expense
    const date = formData.get("date")?.toString();
    const description = formData.get("description")?.toString();
    const account_id = formData.get("account_id")?.toString();
    const category_id = formData.get("category_id")?.toString();
    const subcategory_id = formData.get("subcategory_id")?.toString();

    console.log("Create Transaction Inputs:", { amount, type, date, description, account_id, category_id, subcategory_id });

    if (isNaN(amount) || !type || !date) {
        console.error("Missing required fields or invalid amount:", { amount, type, date });
        return redirect("/transactions/new?error=missing_fields");
    }

    try {
        const { error } = await supabase.from("transactions").insert({
            user_id: user.id,
            amount,
            type,
            date,
            description,
            account_id: (account_id && account_id !== "") ? account_id : null,
            category_id: (category_id && category_id !== "") ? category_id : null,
            subcategory_id: (subcategory_id && subcategory_id !== "") ? subcategory_id : null
        });

        if (error) {
            console.error("Supabase insert error:", error);
            return redirect(`/transactions/new?error=${encodeURIComponent(error.message)}`);
        }

        // Update Account Balance
        if (account_id && account_id !== "") {
            const { data: account, error: accError } = await supabase.from('accounts').select('balance').eq('id', account_id).single();
            if (accError) console.error("Error fetching account balance:", accError);
            if (account) {
                let newBalance = Number(account.balance);
                if (type === 'income') newBalance += amount;
                else newBalance -= amount;

                const { error: updateError } = await supabase.from('accounts').update({ balance: newBalance }).eq('id', account_id);
                if (updateError) console.error("Error updating account balance:", updateError);
            }
        }

        return redirect("/transactions?success=transaction_created");
    } catch (e) {
        console.error("Critical error in create-transaction API:", e);
        return redirect(`/transactions/new?error=internal_server_error`);
    }
};
