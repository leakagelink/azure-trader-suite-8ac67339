CREATE TABLE IF NOT EXISTS public.email_templates (
  key text PRIMARY KEY,
  subject text NOT NULL,
  html_body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email templates"
  ON public.email_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.email_templates (key, subject, html_body) VALUES (
  'signup_credentials',
  '🔐 Your TradixoFX Account Credentials',
  $$<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
  <div style="text-align: center; padding: 30px 20px 20px;"><img src="{{logoUrl}}" alt="TradixoFX" style="max-width: 180px; height: auto;" /></div>
  <div style="background: linear-gradient(135deg, #1a2956, #2a3f7a); padding: 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">Welcome to TradixoFX</h1>
  </div>
  <div style="padding: 35px 30px;">
    <p style="font-size: 16px; color: #1a2956;">Hi <strong>{{userName}}</strong>,</p>
    <p style="font-size: 16px; color: #333; line-height: 1.6;">Your TradixoFX account has been created successfully. Below are your login credentials — please keep them safe.</p>
    <div style="background: #f5f7fb; border: 2px solid #1a2956; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <p style="margin: 0 0 12px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Login Credentials</p>
      <table style="width: 100%; font-size: 14px; color: #1a2956;">
        <tr><td style="padding: 6px 0; font-weight: 600;">Email:</td><td style="padding: 6px 0; font-family: monospace;">{{email}}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Client ID:</td><td style="padding: 6px 0; font-family: monospace;">{{clientId}}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Password:</td><td style="padding: 6px 0; font-family: monospace; font-weight: 700; color: #d4a017;">{{password}}</td></tr>
      </table>
    </div>
    <div style="background: #fffbeb; border-left: 4px solid #d4a017; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #7c5a00; font-size: 13px;">⚠️ <strong>Important:</strong> Your account is pending broker approval. You will receive another email once activated. For security, change your password after first login.</p>
    </div>
    <div style="text-align: center; margin: 30px 0 10px;">
      <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #1a2956, #2a3f7a); color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 700;">Login to Your Account</a>
    </div>
  </div>
  <div style="background: #1a0a0a; padding: 25px 20px; text-align: center;">
    <p style="margin: 0 0 8px; color: #d4a017; font-size: 16px; font-weight: 700; letter-spacing: 1px;">TradixoFX</p>
    <p style="margin: 0; color: #a89070; font-size: 12px;">Trade Smart. Trade Gold.</p>
    <p style="margin: 12px 0 0; color: #6b5544; font-size: 11px;">© {{year}} TradixoFX. All rights reserved.</p>
  </div>
</div>$$
) ON CONFLICT (key) DO NOTHING;