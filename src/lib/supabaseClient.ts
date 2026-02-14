import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL and Key are required for client-side usage.");
}

export const supabase = createClient(
    supabaseUrl || "",
    supabaseKey || "",
    {
        auth: {
            flowType: "pkce",
        },
    }
);
