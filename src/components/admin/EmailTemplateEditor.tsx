import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, Save, RotateCcw, Eye } from "lucide-react";

const TEMPLATE_KEY = "signup_credentials";

const DEFAULT_SUBJECT = "🔐 Your TradixoFX Account Credentials";
const DEFAULT_HTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
  <div style="text-align: center; padding: 30px 20px 20px;"><img src="{{logoUrl}}" alt="TradixoFX" style="max-width: 180px;" /></div>
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
</div>`;

const PREVIEW_VARS: Record<string, string> = {
  userName: "John Doe",
  email: "john@example.com",
  clientId: "100001",
  password: "Aa3$x9KmPq2L",
  logoUrl: "https://guvgsthwiyhkvmvlouxj.supabase.co/storage/v1/object/public/email-assets/logo.png",
  loginUrl: "https://tradixofx.com/auth",
  year: String(new Date().getFullYear()),
};

const render = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");

export default function EmailTemplateEditor() {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("subject, html_body")
        .eq("key", TEMPLATE_KEY)
        .maybeSingle();
      if (data) {
        setSubject(data.subject);
        setHtml(data.html_body);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("email_templates")
      .upsert({
        key: TEMPLATE_KEY,
        subject,
        html_body: html,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      });
    setSaving(false);
    if (error) toast.error("Save failed: " + error.message);
    else toast.success("Template saved. New signups will receive the updated email.");
  };

  const reset = () => {
    setSubject(DEFAULT_SUBJECT);
    setHtml(DEFAULT_HTML);
    toast.info("Reset to defaults. Click Save to apply.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Signup Credentials Email
        </CardTitle>
        <CardDescription>
          Customize the branded email new users receive with their Client ID and auto-generated password.
          Use placeholders: <code className="text-xs">{`{{userName}} {{email}} {{clientId}} {{password}} {{loginUrl}} {{logoUrl}} {{year}}`}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">HTML</TabsTrigger>
                <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1" />Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <Textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  className="font-mono text-xs min-h-[420px]"
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-md bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Subject: <strong>{render(subject, PREVIEW_VARS)}</strong>
                  </p>
                  <iframe
                    title="Email preview"
                    srcDoc={render(html, PREVIEW_VARS)}
                    className="w-full min-h-[500px] bg-white rounded border"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save Template"}
              </Button>
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
