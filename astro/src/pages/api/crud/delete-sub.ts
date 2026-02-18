import { supabase } from "../../../lib/supabase";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, redirect }) => {
    const isJson = request.headers.get("content-type")?.includes("application/json");

    try {
        let id: string | undefined;

        if (isJson) {
            const body = await request.json();
            id = body.id;
        } else {
            const formData = await request.formData();
            id = formData.get("id")?.toString();
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
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            return isJson
                ? new Response(JSON.stringify({ error: error.message }), { status: 400 })
                : redirect(`/subscription/${id}?error=delete_failed`);
        }

        return isJson
            ? new Response(JSON.stringify({ success: true }))
            : redirect("/subscriptions?success=deleted");
    } catch (err: any) {
        return isJson
            ? new Response(JSON.stringify({ error: err.message }), { status: 500 })
            : redirect("/subscriptions?error=server_error");
    }
};
