import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Bell, Shield, Lock, Download, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PageShell, { glassCardClass } from "@/components/PageShell";

const Settings = () => {
  const [appDownloadUrl, setAppDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppUrl = async () => {
      const { data } = await supabase
        .from("payment_settings")
        .select("setting_value")
        .eq("setting_key", "app_download_url")
        .maybeSingle();
      if (data?.setting_value) setAppDownloadUrl(data.setting_value);
    };
    fetchAppUrl();
  }, []);

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  const SectionCard = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <Card className={`${glassCardClass} p-5 sm:p-6 group hover:shadow-2xl transition-all duration-300`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      <div className="relative flex items-center gap-2 mb-5">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-accent/30">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          {title}
        </h2>
      </div>
      <div className="relative space-y-4">{children}</div>
    </Card>
  );

  const SettingRow = ({ id, label, description, defaultChecked }: { id: string; label: string; description: string; defaultChecked?: boolean }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/40 transition-all duration-300">
      <div className="pr-3">
        <Label htmlFor={id} className="text-sm font-semibold cursor-pointer">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch id={id} defaultChecked={defaultChecked} />
    </div>
  );

  return (
    <PageShell title="Settings" subtitle="Manage your preferences and security" icon={SettingsIcon} maxWidth="4xl">
      <div className="space-y-5 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        <SectionCard icon={Bell} title="Notifications">
          <SettingRow id="email-notif" label="Email Notifications" description="Receive updates via email" defaultChecked />
          <SettingRow id="trade-alerts" label="Trade Alerts" description="Get notified about trade executions" defaultChecked />
          <SettingRow id="price-alerts" label="Price Alerts" description="Notifications for price movements" />
        </SectionCard>

        <SectionCard icon={Shield} title="Security">
          <SettingRow id="2fa" label="Two-Factor Authentication" description="Add extra security to your account" />
          <SettingRow id="biometric" label="Biometric Login" description="Use fingerprint or face ID" />
        </SectionCard>

        <SectionCard icon={Lock} title="Privacy">
          <SettingRow id="profile-public" label="Public Profile" description="Make your profile visible to others" />
          <SettingRow id="trade-history" label="Show Trade History" description="Display your trading activity" />
        </SectionCard>

        {appDownloadUrl && (
          <Card className={`${glassCardClass} p-5 sm:p-6 group hover:scale-[1.01] transition-all duration-300`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                  <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                  Download App
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Download our mobile app for the best trading experience on your phone.
              </p>
              <Button
                onClick={() => window.open(appDownloadUrl, '_blank')}
                className="w-full h-11 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:opacity-95 text-white font-semibold rounded-xl shadow-[0_4px_20px_-4px_hsl(160_70%_45%/0.5)] transition-all duration-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Download APK
              </Button>
            </div>
          </Card>
        )}

        <Button
          onClick={handleSave}
          className="w-full h-12 bg-gradient-to-r from-primary via-secondary to-accent hover:opacity-95 text-primary-foreground font-semibold rounded-xl shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)] hover:shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.6)] transition-all duration-300 lg:col-span-2"
        >
          Save All Settings
        </Button>
      </div>
    </PageShell>
  );
};

export default Settings;
