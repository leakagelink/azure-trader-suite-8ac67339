import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOGO_URL = "https://akffmdipruljuaitnhwl.supabase.co/storage/v1/object/public/email-assets/logo.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KYCNotificationRequest {
  email: string;
  userName: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}

const brandHeader = (title: string, gradient: string) => `
  <div style="text-align: center; padding: 30px 20px 20px; background: #ffffff;">
    <img src="${LOGO_URL}" alt="CoinGoldFX" style="max-width: 180px; height: auto; margin-bottom: 10px;" />
  </div>
  <div style="background: ${gradient}; padding: 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">${title}</h1>
  </div>
`;

const brandFooter = `
  <div style="background: #1a0a0a; padding: 25px 20px; text-align: center; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 8px; color: #d4a017; font-size: 16px; font-weight: 700; letter-spacing: 1px;">CoinGoldFX</p>
    <p style="margin: 0; color: #a89070; font-size: 12px;">Trade Smart. Trade Gold.</p>
    <p style="margin: 12px 0 0; color: #6b5544; font-size: 11px;">© ${new Date().getFullYear()} CoinGoldFX. All rights reserved.</p>
  </div>
`;

const handler = async (req: Request): Promise<Response> => {
  console.log("KYC notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userName, status, rejectionReason }: KYCNotificationRequest = await req.json();

    console.log(`Sending KYC ${status} notification to ${email}`);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isApproved = status === "approved";
    
    const subject = isApproved 
      ? "✅ Your CoinGoldFX KYC is Approved!" 
      : "CoinGoldFX KYC Verification Update";

    const htmlContent = isApproved 
      ? `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          ${brandHeader('✅ KYC Approved!', 'linear-gradient(135deg, #7c1d1d, #a83232)')}
          <div style="background: #fffbf5; padding: 35px 30px;">
            <p style="font-size: 16px; color: #2c1810; margin: 0 0 20px;">
              Hi <strong>${userName || 'Trader'}</strong>,
            </p>
            <p style="font-size: 16px; color: #2c1810; line-height: 1.6;">
              Great news! Your KYC verification has been <strong style="color: #7c1d1d;">approved</strong>.
            </p>
            <p style="font-size: 16px; color: #2c1810; line-height: 1.6;">
              You now have full access to all trading features:
            </p>
            <ul style="color: #2c1810; line-height: 1.8; padding-left: 20px;">
              <li>Unlimited trading limits</li>
              <li>Faster withdrawals</li>
              <li>Access to all trading pairs</li>
              <li>Premium customer support</li>
            </ul>
            <div style="text-align: center; margin: 30px 0 10px;">
              <a href="https://coingoldfx.com" style="display: inline-block; background: linear-gradient(135deg, #d4a017, #b8860b); color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 700;">Start Trading</a>
            </div>
          </div>
          ${brandFooter}
        </div>
      `
      : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          ${brandHeader('KYC Verification Update', 'linear-gradient(135deg, #7c1d1d, #5a1414)')}
          <div style="background: #fffbf5; padding: 35px 30px;">
            <p style="font-size: 16px; color: #2c1810; margin: 0 0 20px;">
              Hi <strong>${userName || 'Trader'}</strong>,
            </p>
            <p style="font-size: 16px; color: #2c1810; line-height: 1.6;">
              Unfortunately, your KYC verification could not be approved at this time.
            </p>
            ${rejectionReason ? `
              <div style="background: #fef2f2; border-left: 4px solid #7c1d1d; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #7c1d1d; font-weight: 700;">Reason:</p>
                <p style="margin: 5px 0 0; color: #2c1810;">${rejectionReason}</p>
              </div>
            ` : ''}
            <p style="font-size: 16px; color: #2c1810; line-height: 1.6;">
              Please resubmit with the following in mind:
            </p>
            <ul style="color: #2c1810; line-height: 1.8; padding-left: 20px;">
              <li>Ensure documents are clear and readable</li>
              <li>Make sure documents are not expired</li>
              <li>Names should match across all documents</li>
              <li>Upload high-quality images without blur</li>
            </ul>
          </div>
          ${brandFooter}
        </div>
      `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CoinGoldFX <noreply@coingoldfx.com>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending KYC notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
