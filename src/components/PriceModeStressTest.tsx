import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StressResult {
  iterations: number;
  passed: number;
  failed: number;
  guard_violations: number;
  pnl_violations: number;
  drift_violations: number;
  duration_ms: number;
  sample_violations: string[];
}

const PRESETS = [50, 200, 500, 1000];

export function PriceModeStressTest() {
  const { toast } = useToast();
  const [iterations, setIterations] = useState(200);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<Array<StressResult & { ranAt: Date }>>([]);

  const run = async (n: number) => {
    if (n < 10 || n > 2000) {
      toast({ title: "Invalid range", description: "Use 10–2000 iterations", variant: "destructive" });
      return;
    }
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc(
        "stress_test_price_mode_toggling" as any,
        { p_iterations: n } as any
      );
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as StressResult;
      if (!row) throw new Error("No result returned");
      setHistory((h) => [{ ...row, ranAt: new Date() }, ...h].slice(0, 8));
      if (row.failed === 0) {
        toast({
          title: "Stress test passed",
          description: `${row.passed}/${row.passed + row.failed} checks ok in ${row.duration_ms}ms`,
        });
      } else {
        toast({
          title: "Race condition detected",
          description: `${row.failed} violation(s) — see results below`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Stress test failed", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-accent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-accent" />
          Price-Mode Toggle Stress Test
        </CardTitle>
        <CardDescription>
          Rapidly flips a sandbox position live ↔ edited and verifies guard rails block leaked writes.
          Sandbox row is auto-created and deleted — no real positions touched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label htmlFor="stress-n" className="text-xs">Iterations (10–2000)</Label>
            <Input
              id="stress-n"
              type="number"
              min={10}
              max={2000}
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value) || 0)}
              className="w-32 mt-1"
            />
          </div>
          <div className="flex gap-1">
            {PRESETS.map((n) => (
              <Button key={n} size="sm" variant="outline" onClick={() => setIterations(n)} disabled={running}>
                {n}
              </Button>
            ))}
          </div>
          <Button onClick={() => run(iterations)} disabled={running}>
            {running ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…</>
            ) : (
              <><FlaskConical className="h-4 w-4 mr-2" /> Run stress test</>
            )}
          </Button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet. Each iteration performs 2 toggle + guard checks (~{iterations * 2} total).</p>
        ) : (
          <div className="space-y-2">
            {history.map((r, idx) => (
              <div
                key={idx}
                className={`rounded-md border p-3 ${
                  r.failed === 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {r.failed === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <span className="font-semibold">
                      {r.iterations} iterations
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.ranAt.toLocaleTimeString()} · {r.duration_ms}ms
                    </span>
                  </div>
                  <div className="flex gap-1 text-xs flex-wrap">
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      {r.passed} passed
                    </Badge>
                    {r.failed > 0 && (
                      <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">
                        {r.failed} failed
                      </Badge>
                    )}
                    {r.guard_violations > 0 && (
                      <Badge variant="outline" className="bg-orange-500/15 text-orange-400 border-orange-500/30">
                        guard×{r.guard_violations}
                      </Badge>
                    )}
                    {r.pnl_violations > 0 && (
                      <Badge variant="outline" className="bg-purple-500/15 text-purple-400 border-purple-500/30">
                        pnl×{r.pnl_violations}
                      </Badge>
                    )}
                    {r.drift_violations > 0 && (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                        drift×{r.drift_violations}
                      </Badge>
                    )}
                  </div>
                </div>
                {r.sample_violations && r.sample_violations.length > 0 && (
                  <ul className="mt-2 text-xs font-mono text-red-300 space-y-1">
                    {r.sample_violations.map((v, i) => (
                      <li key={i}>• {v}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
