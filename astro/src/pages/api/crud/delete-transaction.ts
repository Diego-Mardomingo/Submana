
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import {
    parseRequestBody,
    jsonResponse,
    jsonError,
} from "../../../lib/apiHelpers";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
        return redirect("/login");
    }

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser(accessToken.value);
    if (authError || !user) {
        return redirect("/login");
    }

    const { body, isJson } = await parseRequestBody(request);
    const id = body.id;

    if (!id) {
        if (isJson) return jsonError("missing_id");
        return redirect("/transactions?error=missing_id");
    }

    // Get transaction details first to revert balance
    const { data: transaction } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", id)
        .single();

    const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        if (isJson) return jsonError(error.message, 500);
        return redirect(`/transactions?error=${error.message}`);
    }

    // Revert Balance
    if (transaction && transaction.account_id) {
        const { data: account } = await supabase
            .from("accounts")
            .select("balance")
            .eq("id", transaction.account_id)
            .single();
        if (account) {
            let newBalance = Number(account.balance);
            // Reverse operation
            if (transaction.type === "income")
                newBalance -= Number(transaction.amount);
            else newBalance += Number(transaction.amount);

            await supabase
                .from("accounts")
                .update({ balance: newBalance })
                .eq("id", transaction.account_id);
        }
    }

    if (isJson) return jsonResponse({ success: true });
    return redirect("/transactions?success=transaction_deleted");
};
