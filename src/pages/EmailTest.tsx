import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type TestKey =
  | "signup"
  | "account_activated"
  | "account_deactivated"
  | "kyc_approved"
  | "kyc_rejected"
  | "deposit_approved"
  | "deposit_rejected"
  | "withdrawal_approved"
  | "withdrawal_rejected";

interface Result {
  ok: boolean;
  message: string;
  at: string;
}

const TESTS: { key: TestKey; label: string; description: string }[] = [
  { key: "signup", label: "Signup + Login Credentials", description: "Creates a new test user and emails generated password (uses test email)" },
  { key: "account_activated", label: "Account Activated", description: "send-account-notification (activated)" },
  { key: "account_deactivated", label: "Account Deactivated", description: "send-account-notification (deactivated)" },
  { key: "kyc_approved", label: "KYC Approved", description: "send-kyc-notification (approved)" },
  { key: "kyc_rejected", label: "KYC Rejected", description: "send-kyc-notification (rejected)" },
  { key: "deposit_approved", label: "Deposit Approved", description: "send-deposit-notification (approved $100)" },
  { key: "deposit_rejected", label: "Deposit Rejected", description: "send-deposit-notification (rejected)" },
  { key: "withdrawal_approved", label: "Withdrawal Approved", description: "send-withdrawal-notification (approved $50)" },
  { key: "withdrawal_rejected", label: "Withdrawal Rejected", description: "send-withdrawal-notification (rejected)" },
];

const EmailTest = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("Test Trader");
  const [mobile, setMobile] = useState("+919999999999");
  const [running, setRunning] = useState<TestKey | "all" | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setAuthorized(!!data);
      if (user.email) setEmail(user.email);
    })();
  }, [user]);

  const setResult = (key: string, ok: boolean, message: string) =>
    setResults((r) => ({ ...r, [key]: { ok, message, at: new Date().toLocaleTimeString() } }));

  const runOne = async (key: TestKey) => {
    if (!email) {
      toast.error("Recipient email required");
      return;
    }
    setRunning(key);
    try {
      let fn = "";
      let body: any = {};
      switch (key) {
        case "signup":
          fn = "signup-with-generated-password";
          body = { fullName: userName, email, mobileNumber: mobile };
          break;
        case "account_activated":
          fn = "send-account-notification";
          body = { email, userName, status: "activated" };
          break;
        case "account_deactivated":
          fn = "send-account-notification";
          body = { email, userName, status: "deactivated" };
          break;
        case "kyc_approved":
          fn = "send-kyc-notification";
          body = { email, userName, status: "approved" };
          break;
        case "kyc_rejected":
          fn = "send-kyc-notification";
          body = { email, userName, status: "rejected", rejectionReason: "Test rejection — documents unclear" };
          break;
        case "deposit_approved":
          fn = "send-deposit-notification";
          body = { email, userName, status: "approved", amount: 100, currency: "USD" };
          break;
        case "deposit_rejected":
          fn = "send-deposit-notification";
          body = { email, userName, status: "rejected", amount: 100, currency: "USD", rejectionReason: "Test rejection — invalid proof" };
          break;
        case "withdrawal_approved":
          fn = "send-withdrawal-notification";
          body = { email, userName, status: "approved", amount: 50, currency: "USD", transactionRef: "TEST-TXN-12345" };
          break;
        case "withdrawal_rejected":
          fn = "send-withdrawal-notification";
          body = { email, userName, status: "rejected", amount: 50, currency: "USD", rejectionReason: "Test rejection — KYC pending" };
          break;
      }

      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) {
        setResult(key, false, error.message || "Failed");
        toast.error(`${key}: ${error.message}`);
      } else if (data?.error) {
        setResult(key, false, data.error);
        toast.error(`${key}: ${data.error}`);
      } else {
        setResult(key, true, "Sent ✓");
        toast.success(`${key} email sent`);
      }
    } catch (e: any) {
      setResult(key, false, e.message || "Exception");
      toast.error(`${key}: ${e.message}`);
    } finally {
      setRunning(null);
    }
  };

  const runAll = async () => {
    setRunning("all");
    // Skip signup in "run all" — it creates a real user
    for (const t of TESTS.filter((t) => t.key !== "signup")) {
      await runOne(t.key);
      await new Promise((r) => setTimeout(r, 600));
    }
    setRunning(null);
    toast.success("All notification tests completed");
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">This page is for Brokers only.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" /> Email Delivery Test
            </h1>
            <p className="text-sm text-muted-foreground">
              Verify all transactional emails are sending via the updated Resend API key.
            </p>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="email">Recipient Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="name">Recipient Name</Label>
              <Input id="name" value={userName} onChange={(e) => setUserName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile (signup test only)</Label>
              <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={runAll} disabled={!!running}>
              {running === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Run All Notification Tests
            </Button>
            <p className="text-xs text-muted-foreground self-center">
              (Skips Signup — that creates a real user. Run signup separately with a fresh email.)
            </p>
          </div>
        </Card>

        <div className="grid gap-3">
          {TESTS.map((t) => {
            const r = results[t.key];
            return (
              <Card key={t.key} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{t.label}</h3>
                    {r && (
                      <Badge variant={r.ok ? "default" : "destructive"} className="gap-1">
                        {r.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {r.ok ? "Sent" : "Failed"} • {r.at}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  {r && !r.ok && (
                    <p className="text-xs text-destructive mt-1 break-all">{r.message}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runOne(t.key)}
                  disabled={!!running}
                >
                  {running === t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Test"}
                </Button>
              </Card>
            );
          })}
        </div>

        <Card className="p-4 bg-muted/30">
          <p className="text-sm">
            <strong>Note:</strong> If emails don't arrive, check the spam folder. From address is{" "}
            <code className="text-xs">noreply@tradixofx.com</code>. Domain must be verified in Resend.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default EmailTest;
