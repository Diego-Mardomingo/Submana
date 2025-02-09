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
        { status: 401, headers: {Location: "/mysubs?success=false"} }
      );
    }
    // Leer los datos enviados en el json
    const body = await request.json();
    const id = body.id;
    

    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq('id',id);

    if (error) {
      return new Response(JSON.stringify({ success: false, error }), {
        status: 400, headers: {Location: "/mysubs?success=false"}
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 303, headers: {Location: "/mysubs?success=false"} }
    );
  }
};
