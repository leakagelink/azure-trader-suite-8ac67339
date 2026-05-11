import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface ConsistencyRow {
  position_id: string;
  user_id: string;
  symbol: string;
  position_type: string;
  current_price: number;
  entry_price: number;
  amount: number;
  stored_pnl: number;
  expected_pnl: number;
  pnl_drift: number;
  seconds_since_update: number;
  momentum_active: boolean;
  momentum_direction: string | null;
  momentum_target_price: number | null;
  issues: string[];
}

const issueLabel: Record<string, string> = {
  pnl_mismatch: "PnL ≠ formula",
  stale_no_drift: "No drift > 30s",
  momentum_inactive: "Momentum off",
  missing_direction: "No direction",
  missing_target: "No target",
};

const issueColor: Record<string, string> = {
  pnl_mismatch: "bg-red-500/15 text-red-400 border-red-500/30",
  stale_no_drift: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  momentum_inactive: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  missing_direction: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  missing_target: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export function EditedTradesReconciliation() {
  const [rows, setRows] = useState<ConsistencyRow[]>([]);
  const [editedCount, setEditedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [autoRun, setAutoRun] = useState(true);

  const runCheck = async () => {
    setLoading(true);
    try {
      const [{ data: issues, error }, { count }] = await Promise.all([
        supabase.rpc("check_edited_positions_consistency" as any),
        (supabase
          .from("positions")
          .select("id", { count: "exact", head: true }) as any)
          .eq("status", "open")
          .eq("price_mode", "edited"),
      ]);

      if (error) {
        console.error("reconciliation error", error);
      } else {
        setRows((issues || []) as unknown as ConsistencyRow[]);
        setEditedCount(count || 0);
        setLastRun(new Date());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  useEffect(() => {
    if (!autoRun) return;
    const id = window.setInterval(runCheck, 15_000);
    return () => window.clearInterval(id);
  }, [autoRun]);

  const healthy = editedCount > 0 && rows.length === 0;
  const noTrades = editedCount === 0;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Edited Trades Reconciliation
            </CardTitle>
            <CardDescription>
              Verifies cron drift and realtime consistency for all open edited positions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lastRun && (
              <span className="text-[11px] text-muted-foreground">
                Last check: {format(lastRun, "HH:mm:ss")}
              </span>
            )}
            <Button
              variant={autoRun ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRun((v) => !v)}
            >
              {autoRun ? "Auto: On (15s)" : "Auto: Off"}
            </Button>
            <Button variant="outline" size="icon" onClick={runCheck} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-md border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Edited open</div>
            <div className="text-2xl font-bold">{editedCount}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Healthy</div>
            <div className="text-2xl font-bold text-emerald-400">
              {Math.max(0, editedCount - rows.length)}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Issues</div>
            <div className={`text-2xl font-bold ${rows.length > 0 ? "text-red-400" : "text-muted-foreground"}`}>
              {rows.length}
            </div>
          </div>
        </div>

        {noTrades ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <CheckCircle2 className="h-4 w-4" /> No edited trades currently open — nothing to check.
          </div>
        ) : healthy ? (
          <div className="flex items-center gap-2 text-sm text-emerald-400 py-3">
            <CheckCircle2 className="h-4 w-4" /> All {editedCount} edited trade(s) consistent. Cron drift + realtime in sync.
          </div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Stored PnL</TableHead>
                  <TableHead>Expected PnL</TableHead>
                  <TableHead>Drift</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.position_id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{r.symbol}</span>
                        <span
                          className={`text-[10px] uppercase ${
                            r.position_type === "long" ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {r.position_type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {Number(r.stored_pnl).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {Number(r.expected_pnl).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-red-400">
                      {Number(r.pnl_drift).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span
                        className={
                          r.seconds_since_update > 30
                            ? "text-amber-400 font-semibold"
                            : "text-muted-foreground"
                        }
                      >
                        {Number(r.seconds_since_update).toFixed(0)}s ago
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.issues.map((iss) => (
                          <Badge
                            key={iss}
                            variant="outline"
                            className={issueColor[iss] || ""}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {issueLabel[iss] || iss}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
