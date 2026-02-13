import { supabase } from "../../../lib/supabase";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return redirect("/login");
    }

    // Leer los datos enviados en el form
    const formData = await request.formData();
    const service_name = formData.get("name") as string;
    const icon = formData.get("icon") as string;
    const cost = formData.get("cost") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const frequency = formData.get("frequency") as string;
    const frequencyValue = formData.get("frequency_value") as string;

    // Hacer el insert en Supabase
    const { data: insertedData, error } = await supabase
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
      ])
      .select();

    if (error) {
      console.error("Insert error:", error);
      return redirect("/newSubscription?error=insert_failed");
    }

    return redirect("/subscriptions?success=created");
  } catch (err: any) {
    console.error("Server error:", err);
    return redirect("/newSubscription?error=server_error");
  }
};
