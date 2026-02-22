
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

    const { data: sessionData, error: authError } =
        await supabase.auth.setSession({
            access_token: accessToken.value,
            refresh_token: refreshToken.value,
        });

    if (authError || !sessionData.user) {
        return redirect("/login");
    }

    // Update cookies if session was refreshed
    if (
        sessionData.session &&
        sessionData.session.access_token !== accessToken.value
    ) {
        cookies.set("sb-access-token", sessionData.session.access_token, {
            path: "/",
        });
        cookies.set("sb-refresh-token", sessionData.session.refresh_token, {
            path: "/",
        });
    }

    const user = sessionData.user;

    const { body, isJson } = await parseRequestBody(request);
    const amount = parseFloat(body.amount || "");
    const type = body.type; // income, expense
    const date = body.date;
    const description = body.description;
    const account_id = body.account_id;
    const category_id = body.category_id;
    const subcategory_id = body.subcategory_id;

    console.log("Create Transaction Inputs:", {
        amount,
        type,
        date,
        description,
        account_id,
        category_id,
        subcategory_id,
    });

    if (isNaN(amount) || !type || !date) {
        console.error("Missing required fields or invalid amount:", {
            amount,
            type,
            date,
        });
        if (isJson) return jsonError("missing_fields");
        return redirect("/transactions/new?error=missing_fields");
    }

    try {
        const { data: insertedData, error } = await supabase
            .from("transactions")
            .insert({
                user_id: user.id,
                amount,
                type,
                date,
                description,
                account_id: account_id && account_id !== "" ? account_id : null,
                category_id: category_id && category_id !== "" ? category_id : null,
                subcategory_id:
                    subcategory_id && subcategory_id !== "" ? subcategory_id : null,
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase insert error:", error);
            if (isJson) return jsonError(error.message, 500);
            return redirect(
                `/transactions/new?error=${encodeURIComponent(error.message)}`
            );
        }

        // Update Account Balance
        if (account_id && account_id !== "") {
            const { data: account, error: accError } = await supabase
                .from("accounts")
                .select("balance")
                .eq("id", account_id)
                .single();
            if (accError)
                console.error("Error fetching account balance:", accError);
            if (account) {
                let newBalance = Number(account.balance);
                if (type === "income") newBalance += amount;
                else newBalance -= amount;

                const { error: updateError } = await supabase
                    .from("accounts")
                    .update({ balance: newBalance })
                    .eq("id", account_id);
                if (updateError)
                    console.error("Error updating account balance:", updateError);
            }
        }

        if (isJson)
            return jsonResponse({ success: true, transaction: insertedData }, 201);
        return redirect("/transactions?success=transaction_created");
    } catch (e) {
        console.error("Critical error in create-transaction API:", e);
        if (isJson) return jsonError("internal_server_error", 500);
        return redirect(`/transactions/new?error=internal_server_error`);
    }
};
