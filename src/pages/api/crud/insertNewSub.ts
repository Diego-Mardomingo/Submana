import { toast } from "@pheralb/toast";
import { supabase } from "../../../lib/supabase";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    
    if (!user || userError) {
      return new Response(
        JSON.stringify({ success: false, error: "User not authenticated" }),
        { status: 401, headers: {Location: "/?success=false"} }
      );
    }
    // Leer los datos enviados en el form
    const formData = await request.formData();
    const service_name = formData.get("name") as string;
    const cost = formData.get("cost") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const frequency = formData.get("frequency") as string;
    const frequencyValue = formData.get("frequency_value") as string;

    // Hacer el insert en Supabase
    const { data, error } = await supabase
      .from("subscriptions")
      .insert([
        {
          user_id: user.id,
          service_name,
          cost: cost ? parseFloat(cost) : 0,
          start_date: startDate,
          end_date: endDate || null,
          frequency,
          frequency_value: frequencyValue ? parseInt(frequencyValue) : 1,
        },
      ])
      .select();

    if (error) {
      return new Response(JSON.stringify({ success: false, error }), {
        status: 400, headers: {Location: "/?success=false"}
      });
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 303, headers: {Location: "/?success=true&method=insert"} }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 303, headers: {Location: "/?success=false"} }
    );
  }
};
