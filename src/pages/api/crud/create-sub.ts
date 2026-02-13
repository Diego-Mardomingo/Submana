import { supabase } from "../../../lib/supabase";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, redirect }) => {
  const isJson = request.headers.get("content-type")?.includes("application/json");

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return isJson
        ? new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        : redirect("/login");
    }

    let data: any = {};
    if (isJson) {
      data = await request.json();
    } else {
      const formData = await request.formData();
      data = {
        service_name: formData.get("name"),
        icon: formData.get("icon"),
        cost: formData.get("cost"),
        startDate: formData.get("startDate"),
        endDate: formData.get("endDate"),
        frequency: formData.get("frequency"),
        frequency_value: formData.get("frequency_value"),
      };
    }

    const service_name = (data.service_name || data.name) as string;
    const icon = data.icon as string;
    const cost = data.cost as string;
    const startDate = (data.startDate || data.start_date) as string;
    const endDate = (data.endDate || data.end_date) as string;
    const frequency = data.frequency as string;
    const frequencyValue = (data.frequency_value || data.frequencyValue) as string;

    const { error } = await supabase
      .from("subscriptions")
      .insert([
        {
          user_id: user.id,
          service_name,
          icon: icon || `https://ui-avatars.com/api/?name=${service_name || 'Sub'}&length=2&background=random&color=fff&size=256`,
          cost: cost ? parseFloat(cost) : 0,
          start_date: startDate,
          end_date: endDate || null,
          frequency: frequency || 'monthly',
          frequency_value: frequencyValue ? parseInt(frequencyValue) : 1,
        },
      ]);

    if (error) {
      console.error("Insert error:", error);
      return isJson
        ? new Response(JSON.stringify({ error: error.message }), { status: 400 })
        : redirect("/newSubscription?error=insert_failed");
    }

    return isJson
      ? new Response(JSON.stringify({ success: true }))
      : redirect("/subscriptions?success=created");
  } catch (err: any) {
    console.error("Server error:", err);
    return isJson
      ? new Response(JSON.stringify({ error: err.message }), { status: 500 })
      : redirect("/newSubscription?error=server_error");
  }
};
