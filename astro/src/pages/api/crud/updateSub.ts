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
        { status: 401,
          headers: { "Content-Type": "application/json" }}
      );
    }

    const body = await request.json();
    const { id, service_name, icon, cost, start_date, end_date, frequency, frequency_value } = body;
    
    // Actualizamos la suscripción en la tabla
    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        service_name,
        icon,
        cost,
        start_date,
        end_date,
        frequency,
        frequency_value
      })
      .eq("id", id);

    if (error) {
      return new Response(JSON.stringify({ success: false, error }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
