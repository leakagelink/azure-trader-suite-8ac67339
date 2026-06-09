import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Clock, CheckCircle, XCircle, ArrowUpRight, Hash, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PageShell, { glassCardClass } from "@/components/PageShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface WithdrawalRow {
  id: string;
  amount: number;
  currency: string;
  withdrawal_method: string;
  account_details: any;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
  transaction_reference: string | null;
  admin_notes: string | null;
}

const statusMeta: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Pending", cls: "bg-amber-500", icon: Clock },
  approved: { label: "Approved", cls: "bg-emerald-500", icon: CheckCircle },
  rejected: { label: "Rejected", cls: "bg-destructive", icon: XCircle },
};

const formatDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

const renderAccountDetails = (method: string, details: any) => {
  if (!details || typeof details !== "object") return null;
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 p-3 rounded-lg bg-muted/40 border border-border/40">
      {entries.map(([k, v]) => (
        <div key={k} className="text-xs">
          <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}: </span>
          <span className="font-mono font-medium break-all">{String(v)}</span>
        </div>
      ))}
    </div>
  );
};

const WithdrawalHistory = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load withdrawal history");
    } finally {
      setLoading(false);
    }
  };

  const filtered = tab === "all" ? rows : rows.filter((r) => r.status === tab);

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  return (
    <PageShell title="Withdrawal History" subtitle="Track all your withdrawal requests" icon={History} maxWidth="wide">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-5">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-0 space-y-4">
          {loading ? (
            <Card className={`${glassCardClass} p-10 text-center text-sm text-muted-foreground`}>
              Loading withdrawal history...
            </Card>
          ) : filtered.length === 0 ? (
            <Card className={`${glassCardClass} p-10 text-center`}>
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted/60 border border-border/60 flex items-center justify-center">
                  <ArrowUpRight className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No withdrawal requests found</p>
                <Button onClick={() => navigate("/wallet")} variant="outline" size="sm">
                  Go to Wallet
                </Button>
              </div>
            </Card>
          ) : (
            filtered.map((row) => {
              const meta = statusMeta[row.status] ?? statusMeta.pending;
              const Icon = meta.icon;
              return (
                <Card key={row.id} className={`${glassCardClass} p-5`}>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
                  <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${
                        row.status === "approved" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600" :
                        row.status === "rejected" ? "bg-destructive/15 border-destructive/30 text-destructive" :
                        "bg-amber-500/15 border-amber-500/30 text-amber-600"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base">
                            ${Number(row.amount).toFixed(2)} <span className="text-xs text-muted-foreground font-medium">{row.currency}</span>
                          </h3>
                          <Badge className={meta.cls}>{meta.label}</Badge>
                          <Badge variant="outline" className="capitalize">
                            {row.withdrawal_method?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Requested: {formatDateTime(row.created_at)}
                        </p>
                        {row.processed_at && (
                          <p className="text-xs text-muted-foreground">
                            Processed: {formatDateTime(row.processed_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      <span className="font-mono">{row.id.slice(0, 8)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          navigator.clipboard.writeText(row.id);
                          toast.success("Request ID copied");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {renderAccountDetails(row.withdrawal_method, row.account_details)}

                  {row.status === "approved" && row.transaction_reference && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                      <span className="text-muted-foreground">Transaction Reference: </span>
                      <span className="font-mono font-semibold text-emerald-700">{row.transaction_reference}</span>
                    </div>
                  )}

                  {row.status === "rejected" && row.rejection_reason && (
                    <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs">
                      <span className="text-muted-foreground">Reason: </span>
                      <span className="font-medium text-destructive">{row.rejection_reason}</span>
                    </div>
                  )}

                  {row.admin_notes && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/40 text-xs">
                      <span className="text-muted-foreground">Broker note: </span>
                      <span className="font-medium">{row.admin_notes}</span>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default WithdrawalHistory;
