import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();
    const cleanUsername = String(username || "").trim();

    if (!/^[A-Za-z0-9_]{3,24}$/.test(cleanUsername) || !password) {
      return new Response(JSON.stringify({ error: "Invalid username or password." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("email")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return new Response(JSON.stringify({ error: "Invalid username or password." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await admin.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (error || !data.session) {
      return new Response(JSON.stringify({ error: "Invalid username or password." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ session: data.session }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to log in right now." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
