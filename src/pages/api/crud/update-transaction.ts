
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
    const id = formData.get("id")?.toString();
    const amount = parseFloat(formData.get("amount")?.toString() || "0");
    const type = formData.get("type")?.toString(); // income, expense
    const date = formData.get("date")?.toString();
    const description = formData.get("description")?.toString();
    const account_id = formData.get("account_id")?.toString();
    const category_id = formData.get("category_id")?.toString();

    if (!id || !amount || !type || !date) {
        return redirect("/transactions?error=missing_fields");
    }

    try {
        // 1. Get old transaction to revert balance
        const { data: oldTx, error: fetchError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !oldTx) {
            return redirect("/transactions?error=transaction_not_found");
        }

        // 2. Revert old balance impact
        if (oldTx.account_id) {
            const { data: oldAcc } = await supabase.from('accounts').select('balance').eq('id', oldTx.account_id).single();
            if (oldAcc) {
                let revertedBalance = Number(oldAcc.balance);
                // If it was income, we subtract. If expense, we add back.
                if (oldTx.type === 'income') revertedBalance -= Number(oldTx.amount);
                else revertedBalance += Number(oldTx.amount);

                await supabase.from('accounts').update({ balance: revertedBalance }).eq('id', oldTx.account_id);
            }
        }

        // 3. Update Transaction
        const { error: updateError } = await supabase.from("transactions").update({
            amount,
            type,
            date,
            description,
            account_id: account_id || null,
            category_id: category_id || null
        }).eq('id', id).eq('user_id', user.id);

        if (updateError) throw updateError;

        // 4. Apply new balance impact
        if (account_id) {
            const { data: newAcc } = await supabase.from('accounts').select('balance').eq('id', account_id).single();
            if (newAcc) {
                let newBalance = Number(newAcc.balance);
                if (type === 'income') newBalance += amount;
                else newBalance -= amount;

                await supabase.from('accounts').update({ balance: newBalance }).eq('id', account_id);
            }
        }

    } catch (error) {
        console.error("Error updating transaction:", error);
        return redirect(`/transactions?error=${encodeURIComponent(error.message)}`);
    }

    return redirect("/transactions?success=transaction_updated");
};
