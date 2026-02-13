
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
        return redirect("/login");
    }

    const { data, error: authError } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
    });

    if (authError || !data.user) {
        return redirect("/login");
    }
    const user = data.user;

    const formData = await request.formData();
    const amount = parseFloat(formData.get("amount")?.toString() || "0");
    const type = formData.get("type")?.toString(); // income, expense
    const date = formData.get("date")?.toString();
    const description = formData.get("description")?.toString();
    const account_id = formData.get("account_id")?.toString();
    const category_id = formData.get("category_id")?.toString();

    if (!amount || !type || !date) {
        return redirect("/transactions/new?error=missing_fields");
    }

    const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        amount,
        type,
        date,
        description,
        account_id: account_id || null,
        category_id: category_id && category_id !== "" ? category_id : null
    });

    if (error) {
        return redirect(`/transactions/new?error=${error.message}`);
    }

    // Update Account Balance (Optional but recommended)
    if (account_id) {
        // Fetch current balance
        const { data: account } = await supabase.from('accounts').select('balance').eq('id', account_id).single();
        if (account) {
            let newBalance = Number(account.balance);
            if (type === 'income') newBalance += amount;
            else newBalance -= amount;

            await supabase.from('accounts').update({ balance: newBalance }).eq('id', account_id);
        }
    }

    return redirect("/transactions?success=transaction_created");
};
