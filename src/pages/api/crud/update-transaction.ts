
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

    // Update cookies if refreshed
    if (sessionData.session && sessionData.session.access_token !== accessToken.value) {
        cookies.set("sb-access-token", sessionData.session.access_token, { path: "/" });
        cookies.set("sb-refresh-token", sessionData.session.refresh_token, { path: "/" });
    }

    const user = sessionData.user;

    const formData = await request.formData();
    const id = formData.get("id")?.toString();
    const amountStr = formData.get("amount")?.toString() || "";
    const amount = parseFloat(amountStr);
    const type = formData.get("type")?.toString(); // income, expense
    const date = formData.get("date")?.toString();
    const description = formData.get("description")?.toString();
    const account_id = formData.get("account_id")?.toString();
    const category_id = formData.get("category_id")?.toString();
    const subcategory_id = formData.get("subcategory_id")?.toString();

    console.log("Update Transaction Inputs:", { id, amount, type, date, description, account_id, category_id, subcategory_id });

    if (!id || isNaN(amount) || !type || !date) {
        console.error("Missing fields or invalid amount for update:", { id, amount, type, date });
        return redirect("/transactions?error=missing_fields");
    }

    try {
        // ... (existing code, keeping indentation)
        // 1. Get old transaction to revert balance
        const { data: oldTx, error: fetchError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !oldTx) {
            console.error("Transaction not found or fetch error:", fetchError);
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
            account_id: (account_id && account_id !== "") ? account_id : null,
            category_id: (category_id && category_id !== "") ? category_id : null,
            subcategory_id: (subcategory_id && subcategory_id !== "") ? subcategory_id : null
        }).eq('id', id).eq('user_id', user.id);

        if (updateError) {
            console.error("Supabase update error:", updateError);
            throw updateError;
        }

        // 4. Apply new balance impact
        const newAccountId = (account_id && account_id !== "") ? account_id : null;
        if (newAccountId) {
            const { data: newAcc, error: newAccErr } = await supabase.from('accounts').select('balance').eq('id', newAccountId).single();
            if (newAccErr) console.error("Error fetching new account balance:", newAccErr);
            if (newAcc) {
                let newBalance = Number(newAcc.balance);
                if (type === 'income') newBalance += amount;
                else newBalance -= amount;

                const { error: updateAccErr } = await supabase.from('accounts').update({ balance: newBalance }).eq('id', newAccountId);
                if (updateAccErr) console.error("Error updating new account balance:", updateAccErr);
            }
        }

    } catch (error) {
        console.error("Error in update-transaction API:", error);
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        return redirect(`/transactions/edit/${id}?error=${encodeURIComponent(errorMsg)}`);
    }

    return redirect("/transactions?success=transaction_updated");
};
