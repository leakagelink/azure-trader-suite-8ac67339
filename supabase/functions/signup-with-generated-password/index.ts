import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOGO_URL = "https://guvgsthwiyhkvmvlouxj.supabase.co/storage/v1/object/public/email-assets/logo.png";

interface SignupBody {
  fullName: string;
  email: string;
  mobileNumber: string;
}

// Generate strong random password: 12 chars with mixed types
const generatePassword = (): string => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const nums = "23456789";
  const syms = "!@#$%&*";
  const all = upper + lower + nums + syms;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pwd = pick(upper) + pick(lower) + pick(nums) + pick(syms);
  for (let i = 0; i < 8; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
};

const DEFAULT_SUBJECT = "🔐 Your TradixoFX Account Credentials";
const DEFAULT_HTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
  <div style="text-align: center; padding: 30px 20px 20px;"><img src="{{logoUrl}}" alt="TradixoFX" style="max-width: 180px;" /></div>
  <div style="background: linear-gradient(135deg, #1a2956, #2a3f7a); padding: 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Welcome to TradixoFX</h1>
  </div>
  <div style="padding: 35px 30px;">
    <p>Hi <strong>{{userName}}</strong>,</p>
    <p>Your account has been created. Login credentials below:</p>
    <p><b>Email:</b> {{email}}<br/><b>Client ID:</b> {{clientId}}<br/><b>Password:</b> {{password}}</p>
    <p><a href="{{loginUrl}}">Login</a></p>
  </div>
</div>`;

const renderTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: SignupBody = await req.json();
    const { fullName, email, mobileNumber } = body;

    if (!fullName || !email || !mobileNumber) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const password = generatePassword();

    // Create user via admin API (auto-confirms email)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, mobile_number: mobileNumber },
    });

    if (createErr || !created.user) {
      console.error("Create user error:", createErr);
      const msg = createErr?.message?.includes("already")
        ? "This email is already registered. Please sign in instead."
        : (createErr?.message || "Failed to create account");
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch generated client_id from profile (created by handle_new_user trigger)
    const { data: profile } = await admin
      .from("profiles")
      .select("client_id")
      .eq("id", created.user.id)
      .maybeSingle();

    const clientId = profile?.client_id || "—";

    // Send credentials email
    if (RESEND_API_KEY) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "TradixoFX <noreply@tradixofx.com>",
            to: [email],
            subject: "🔐 Your TradixoFX Account Credentials",
            html: buildEmail(fullName, email, password, clientId),
          }),
        });
        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          console.error("Resend send failed:", errBody);
        }
      } catch (e) {
        console.error("Email send exception:", e);
      }
    } else {
      console.warn("RESEND_API_KEY not set — skipping credentials email");
    }

    return new Response(
      JSON.stringify({ success: true, clientId: clientId.replace(/^CGF/i, "") }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("signup-with-generated-password error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
