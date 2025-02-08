import { supabase } from "../../../lib/supabase";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    
    if (!user || userError) {
      return new Response(
        JSON.stringify({ success: false, error: "User not authenticated" }),
        { status: 401 }
      );
    }
    
    let { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)

    if (error) {
      return new Response(JSON.stringify({ success: false, error }), {
        status: 400
      });
    }

    return new Response(
      JSON.stringify({ success: true, subscriptions }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 303 }
    );
  }
};
