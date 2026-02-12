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

        const updates = {
            service_name: formData.get("name")?.toString(),
            icon: formData.get("icon")?.toString(),
            cost: parseFloat(formData.get("cost")?.toString() || "0"),
            start_date: formData.get("startDate")?.toString(),
            end_date: formData.get("endDate")?.toString() || null,
            frequency: formData.get("frequency")?.toString(),
            frequency_value: parseInt(formData.get("frequency_value")?.toString() || "1"),
        };

        const { error } = await supabase
            .from("subscriptions")
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            return redirect(`/subscription/${id}/edit?error=update_failed`);
        }

        return redirect(`/subscription/${id}?success=updated`);
    } catch (err) {
        return redirect(`/subscription/${id}?error=server_error`);
    }
};
