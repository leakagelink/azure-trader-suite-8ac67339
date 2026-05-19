import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, FileCheck, CheckCircle, Clock, XCircle, ChevronRight, Phone, Hash, Copy, Download, Smartphone, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import PageShell, { glassCardClass } from "@/components/PageShell";
import PaymentMethodsManager from "@/components/PaymentMethodsManager";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  client_id: string | null;
  created_at: string;
}

interface KYCStatus {
  status: 'pending' | 'approved' | 'rejected';
}

interface TradeHistoryItem {
  type: string;
  amount: string;
  date: string;
  status: string;
  isProfit: boolean;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [appDownloadUrl, setAppDownloadUrl] = useState<string | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) fetchProfile();
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles").select("*").eq("id", user?.id).single();
      if (error) throw error;
      setProfile(data);
      setFullName(data.full_name || "");

      const { data: kycData } = await supabase
        .from("kyc_submissions").select("status").eq("user_id", user?.id).maybeSingle();
      if (kycData) setKycStatus(kycData as KYCStatus);

      const { data: appUrlSetting } = await supabase
        .from("payment_settings").select("setting_value").eq("setting_key", "app_download_url").maybeSingle();
      if (appUrlSetting?.setting_value) setAppDownloadUrl(appUrlSetting.setting_value);

      const { data: tradeTxs } = await supabase
        .from("wallet_transactions").select("*").eq("user_id", user?.id)
        .eq("type", "trade").order("created_at", { ascending: false }).limit(10);
      if (tradeTxs) {
        setTradeHistory(tradeTxs.map((tx) => ({
          type: "Trade",
          amount: Number(tx.amount) >= 0 ? `+$${Number(tx.amount).toFixed(2)}` : `-$${Math.abs(Number(tx.amount)).toFixed(2)}`,
          date: new Date(tx.created_at).toLocaleDateString(),
          status: tx.status,
          isProfit: Number(tx.amount) >= 0,
        })));
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles").update({ full_name: fullName }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated successfully!");
      fetchProfile();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long" });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background">
        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-card/60 backdrop-blur-xl border border-border/60">
          <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell title="My Profile" subtitle="Manage your account information" icon={User} maxWidth="wide">
      {/* Client ID Card - full width banner */}
      {profile?.client_id && (
        <Card className={`${glassCardClass} p-4 mb-5 group hover:scale-[1.01] transition-all duration-300`}>
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 border border-accent/40 flex items-center justify-center shadow-lg">
                <Hash className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Your Client ID</p>
                <p className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{profile.client_id}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-primary/10 hover:text-primary"
              onClick={() => {
                navigator.clipboard.writeText(profile.client_id || "");
                toast.success("Client ID copied!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="relative text-xs text-muted-foreground mt-2">
            Use this ID to login along with email or mobile number
          </p>
        </Card>
      )}

      {/* Pro 2-column desktop layout */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-6 xl:gap-8">
        <div>
      <Card className={`${glassCardClass} p-5 sm:p-6 mb-5`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <div className="relative flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-br from-primary via-secondary to-accent rounded-full blur-md opacity-60 animate-pulse" />
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-xl">
              <User className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {profile?.full_name || "User"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Member since {profile?.created_at ? formatDate(profile.created_at) : "Unknown"}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs uppercase tracking-wide font-semibold">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name" type="text" value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10 h-11 bg-card/60 backdrop-blur-xl border-border/60 focus:border-primary/60 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-wide font-semibold">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email" type="email"
                value={profile?.email || user?.email || ""}
                className="pl-10 h-11 bg-muted/40 border-border/60 rounded-xl"
                disabled
              />
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-xs uppercase tracking-wide font-semibold">Mobile Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="mobile" type="tel"
                value={profile?.mobile_number || ""}
                className="pl-10 h-11 bg-muted/40 border-border/60 rounded-xl"
                disabled
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-primary via-secondary to-accent hover:opacity-95 text-primary-foreground font-semibold rounded-xl shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)] hover:shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.6)] transition-all duration-300"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </Card>

      {/* Trade History stays in left column */}
      <Card className={`${glassCardClass} p-5`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <h2 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-accent/30">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Trade History
          </span>
        </h2>
        {loading ? (
          <p className="text-muted-foreground text-center py-8 text-sm">Loading trade history...</p>
        ) : tradeHistory.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 text-sm">No trade history yet</p>
        ) : (
          <div className="space-y-3">
            {tradeHistory.map((trade, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 transition-all duration-300">
                <div>
                  <div className="font-semibold text-sm">{trade.type}</div>
                  <div className="text-xs text-muted-foreground">{trade.date}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-sm ${trade.isProfit ? "text-emerald-500" : "text-red-500"}`}>{trade.amount}</div>
                  <div className="text-xs text-muted-foreground capitalize">{trade.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
        </div>

        {/* Right column: app, kyc, account info */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-5">
      {/* App Download Card */}
        <Card className={`${glassCardClass} p-5 mb-5 group hover:scale-[1.01] transition-all duration-300`}>
          <div className="absolute inset-0 bg-primary/5" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base">Download Mobile App</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {appDownloadUrl ? "Get the TradixoFX app for better trading" : "App will appear here after Broker upload"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              disabled={!appDownloadUrl}
              onClick={() => window.open(appDownloadUrl, '_blank')}
              className="rounded-xl flex-shrink-0"
            >
              <Download className="h-4 w-4 mr-1.5" />
              {appDownloadUrl ? "Get" : "Pending"}
            </Button>
          </div>
        </Card>

      {/* KYC Verification Card */}
      <Card
        className={`${glassCardClass} p-5 mb-5 cursor-pointer group hover:scale-[1.01] transition-all duration-300`}
        onClick={() => navigate("/kyc")}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${
              kycStatus?.status === "approved" ? "bg-emerald-500/20 border-emerald-500/40" :
              kycStatus?.status === "rejected" ? "bg-destructive/20 border-destructive/40" :
              kycStatus?.status === "pending" ? "bg-amber-500/20 border-amber-500/40" :
              "bg-muted border-border"
            }`}>
              {kycStatus?.status === "approved" ? (
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              ) : kycStatus?.status === "rejected" ? (
                <XCircle className="h-6 w-6 text-destructive" />
              ) : kycStatus?.status === "pending" ? (
                <Clock className="h-6 w-6 text-amber-500" />
              ) : (
                <FileCheck className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-bold flex items-center gap-2 text-sm sm:text-base">
                KYC Verification
                {kycStatus && (
                  <Badge className={
                    kycStatus.status === "approved" ? "bg-emerald-500" :
                    kycStatus.status === "rejected" ? "bg-destructive" :
                    "bg-amber-500"
                  }>
                    {kycStatus.status.charAt(0).toUpperCase() + kycStatus.status.slice(1)}
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                {kycStatus?.status === "approved" ? "Your identity is verified"
                  : kycStatus?.status === "pending" ? "Verification in progress"
                  : kycStatus?.status === "rejected" ? "Please resubmit your documents"
                  : "Complete your identity verification"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </Card>
      <PaymentMethodsManager />


      <Card className={`${glassCardClass} p-5 mb-5`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <h3 className="text-base sm:text-lg font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Account Information
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center pb-2 border-b border-border/40">
            <span className="text-muted-foreground">Client ID:</span>
            <span className="font-mono font-bold text-primary">{profile?.client_id || "N/A"}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-border/40">
            <span className="text-muted-foreground">Account ID:</span>
            <span className="font-mono text-xs">{user?.id.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Email Verified:</span>
            <span className={user?.email_confirmed_at ? "text-emerald-500 font-semibold" : "text-amber-500 font-semibold"}>
              {user?.email_confirmed_at ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </Card>
        </div>
      </div>
    </PageShell>
  );
};

export default Profile;
