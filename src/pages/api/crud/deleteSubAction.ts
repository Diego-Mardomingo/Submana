import { supabase } from "../../../lib/supabase";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, redirect }) => {
    try {
        const formData = await request.formData();
        const id = formData.get("id")?.toString();

        if (!id) {
            return new Response("Missing ID", { status: 400 });
        }

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (!user || userError) {
            return redirect("/login");
        }

        const { error } = await supabase
            .from("subscriptions")
            .delete()
            .eq('id', id)
            .eq('user_id', user.id); // Security: ensure user owns the sub

        if (error) {
            return redirect(`/subscription/${id}?error=delete_failed`);
        }

        return redirect("/subscriptions?success=deleted");
    } catch (err) {
        return redirect("/subscriptions?error=server_error");
    }
};
