import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileCheck, Clock, CheckCircle2, XCircle, FileText, ShieldCheck, Timer, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PageShell, { glassCardClass } from "@/components/PageShell";

interface KycRow {
  id: string;
  status: "pending" | "approved" | "rejected";
  first_name: string | null;
  last_name: string | null;
  id_document_type: string | null;
  created_at: string;
  updated_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

const formatDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

const SLA_HOURS = 4;

const KYCStatusTracker = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [kyc, setKyc] = useState<KycRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) fetchData();
  }, [user, authLoading]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("id, status, first_name, last_name, id_document_type, created_at, updated_at, reviewed_at, rejection_reason")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      setKyc((data as any) || null);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load KYC status");
    } finally {
      setLoading(false);
    }
  };

  // Calculate timer / SLA
  const submittedAt = kyc?.created_at ? new Date(kyc.created_at).getTime() : null;
  const elapsedMs = submittedAt ? now - submittedAt : 0;
  const slaMs = SLA_HOURS * 60 * 60 * 1000;
  const remainingMs = Math.max(0, slaMs - elapsedMs);
  const progress = submittedAt ? Math.min(100, (elapsedMs / slaMs) * 100) : 0;
  const overdue = submittedAt && remainingMs === 0 && kyc?.status === "pending";

  const remainingLabel = (() => {
    if (!submittedAt) return "—";
    if (remainingMs === 0) return "Any moment now";
    const mins = Math.floor(remainingMs / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  const steps = [
    {
      key: "submitted",
      label: "Submitted",
      desc: "Your documents have been received",
      icon: FileText,
      done: !!kyc,
      timestamp: kyc?.created_at,
    },
    {
      key: "pending",
      label: "Under Review",
      desc: "Broker is verifying your documents",
      icon: Clock,
      done: !!kyc,
      active: kyc?.status === "pending",
      timestamp: kyc?.updated_at,
    },
    {
      key: "decision",
      label: kyc?.status === "rejected" ? "Rejected" : "Approved",
      desc: kyc?.status === "approved"
        ? "Your identity is verified"
        : kyc?.status === "rejected"
        ? "Please resubmit your documents"
        : "Estimated within 4 hours of submission",
      icon: kyc?.status === "rejected" ? XCircle : CheckCircle2,
      done: kyc?.status === "approved" || kyc?.status === "rejected",
      active: kyc?.status === "approved" || kyc?.status === "rejected",
      isError: kyc?.status === "rejected",
      timestamp: kyc?.reviewed_at,
    },
  ];

  if (loading) {
    return (
      <PageShell title="KYC Status" subtitle="Track your verification" icon={ShieldCheck}>
        <Card className={`${glassCardClass} p-10 text-center text-sm text-muted-foreground`}>
          Loading KYC status...
        </Card>
      </PageShell>
    );
  }

  if (!kyc) {
    return (
      <PageShell title="KYC Status" subtitle="Track your verification" icon={ShieldCheck}>
        <Card className={`${glassCardClass} p-10 text-center`}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 border border-border/60 flex items-center justify-center">
              <FileCheck className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-bold">No KYC submission yet</h3>
            <p className="text-sm text-muted-foreground">Submit your KYC documents to start verification</p>
            <Button onClick={() => navigate("/kyc")} className="mt-2">Start KYC</Button>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title="KYC Status" subtitle="Track your verification progress" icon={ShieldCheck} maxWidth="wide">
      {/* Hero Status Card */}
      <Card className={`${glassCardClass} p-5 sm:p-6 mb-5`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border ${
              kyc.status === "approved" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600" :
              kyc.status === "rejected" ? "bg-destructive/15 border-destructive/30 text-destructive" :
              "bg-amber-500/15 border-amber-500/30 text-amber-600"
            }`}>
              {kyc.status === "approved" ? <CheckCircle2 className="h-7 w-7" /> :
               kyc.status === "rejected" ? <XCircle className="h-7 w-7" /> :
               <Clock className="h-7 w-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">
                  {kyc.status === "approved" ? "Verified" :
                   kyc.status === "rejected" ? "Rejected" : "Under Review"}
                </h2>
                <Badge className={
                  kyc.status === "approved" ? "bg-emerald-500" :
                  kyc.status === "rejected" ? "bg-destructive" : "bg-amber-500"
                }>
                  {kyc.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kyc.first_name} {kyc.last_name} · {kyc.id_document_type || "Document"}
              </p>
            </div>
          </div>

          {kyc.status === "pending" && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Timer className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Estimated time remaining</p>
                <p className="text-base font-bold text-primary">{remainingLabel}</p>
              </div>
            </div>
          )}
        </div>

        {kyc.status === "pending" && (
          <div className="relative mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Submitted</span>
              <span>Approval within {SLA_HOURS}h</span>
            </div>
            <Progress value={progress} className="h-2" />
            {overdue && (
              <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>Approval is taking longer than usual. The broker will reach out shortly.</span>
              </div>
            )}
          </div>
        )}

        {kyc.status === "rejected" && kyc.rejection_reason && (
          <div className="relative mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs">
            <span className="text-muted-foreground">Reason: </span>
            <span className="font-medium text-destructive">{kyc.rejection_reason}</span>
          </div>
        )}

        {kyc.status === "rejected" && (
          <div className="relative mt-4">
            <Button onClick={() => navigate("/kyc")} className="w-full">Resubmit KYC</Button>
          </div>
        )}
      </Card>

      {/* Timeline Steps */}
      <Card className={`${glassCardClass} p-5 sm:p-6`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <h3 className="relative text-base font-bold mb-5 flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Timer className="h-4 w-4 text-primary" />
          </div>
          Verification Timeline
        </h3>

        <div className="relative space-y-5">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const last = idx === steps.length - 1;
            return (
              <div key={step.key} className="relative flex gap-4">
                {/* connector line */}
                {!last && (
                  <span className={`absolute left-5 top-11 bottom-[-20px] w-px ${
                    step.done ? "bg-primary/40" : "bg-border"
                  }`} />
                )}
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 flex-shrink-0 z-10 ${
                  step.isError ? "bg-destructive/15 border-destructive text-destructive" :
                  step.done && step.active ? "bg-emerald-500/15 border-emerald-500 text-emerald-600" :
                  step.done ? "bg-primary/15 border-primary text-primary" :
                  "bg-muted border-border text-muted-foreground"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className={`font-semibold text-sm ${
                      step.isError ? "text-destructive" :
                      step.done ? "" : "text-muted-foreground"
                    }`}>
                      {step.label}
                    </h4>
                    {step.timestamp && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatDateTime(step.timestamp)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageShell>
  );
};

export default KYCStatusTracker;
