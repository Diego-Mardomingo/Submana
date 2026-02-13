import { supabase } from "../../../lib/supabase";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, redirect }) => {
    const isJson = request.headers.get("content-type")?.includes("application/json");

    try {
        let id: string | undefined;
        let updates: any = {};

        if (isJson) {
            const body = await request.json();
            id = body.id;
            updates = {
                service_name: body.service_name,
                icon: body.icon,
                cost: parseFloat(body.cost || "0"),
                start_date: body.start_date,
                end_date: body.end_date || null,
                frequency: body.frequency,
                frequency_value: parseInt(body.frequency_value || "1"),
            };
        } else {
            const formData = await request.formData();
            id = formData.get("id")?.toString();
            updates = {
                service_name: formData.get("name")?.toString(),
                icon: formData.get("icon")?.toString(),
                cost: parseFloat(formData.get("cost")?.toString() || "0"),
                start_date: formData.get("startDate")?.toString(),
                end_date: formData.get("endDate")?.toString() || null,
                frequency: formData.get("frequency")?.toString(),
                frequency_value: parseInt(formData.get("frequency_value")?.toString() || "1"),
            };
        }

        if (!id) {
            return isJson
                ? new Response(JSON.stringify({ error: "Missing ID" }), { status: 400 })
                : new Response("Missing ID", { status: 400 });
        }

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (!user || userError) {
            return isJson
                ? new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
                : redirect("/login");
        }

        const { error } = await supabase
            .from("subscriptions")
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error("Update error:", error);
            return isJson
                ? new Response(JSON.stringify({ error: error.message }), { status: 400 })
                : redirect(`/subscription/${id}/edit?error=update_failed`);
        }

        return isJson
            ? new Response(JSON.stringify({ success: true }))
            : redirect(`/subscription/${id}?success=updated`);
    } catch (err: any) {
        console.error("Server error:", err);
        return isJson
            ? new Response(JSON.stringify({ error: err.message }), { status: 500 })
            : redirect(`/subscriptions?error=server_error`);
    }
};
