import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, Trash2, Bell, BellOff } from "lucide-react";
import { useModeEvents } from "@/hooks/useModeEvents";
import { modeLogger, type ModeEventLevel, type ModeEventKind } from "@/lib/modeEventLogger";
import { toast } from "sonner";
import { format } from "date-fns";

const LEVELS: ModeEventLevel[] = ["debug", "info", "warn", "error"];
const KINDS: ModeEventKind[] = [
  "db_update",
  "db_skip",
  "db_guard_block",
  "realtime_in",
  "mode_transition",
  "reset_to_live",
  "manual_close",
  "error",
];

const levelStyle: Record<ModeEventLevel, string> = {
  debug: "bg-muted text-muted-foreground border-border",
  info: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

const kindStyle: Record<string, string> = {
  db_update: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  db_skip: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  db_guard_block: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  realtime_in: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  mode_transition: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  reset_to_live: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  manual_close: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

export function ModeEventsConsole() {
  const events = useModeEvents(500);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [alertsOn, setAlertsOn] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  // Toast on warn/error when alerts enabled
  useEffect(() => {
    if (!alertsOn) return;
    const off = modeLogger.subscribe((evt) => {
      if (evt.level === "error") {
        toast.error(`[${evt.kind}] ${evt.message}`, {
          description: evt.symbol ? `${evt.symbol} • ${evt.source}` : evt.source,
        });
      } else if (evt.level === "warn") {
        toast.warning(`[${evt.kind}] ${evt.message}`, {
          description: evt.symbol ? `${evt.symbol} • ${evt.source}` : evt.source,
        });
      }
    });
    return off;
  }, [alertsOn]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events
      .filter((e) => levelFilter === "all" || e.level === levelFilter)
      .filter((e) => kindFilter === "all" || e.kind === kindFilter)
      .filter((e) => {
        if (!term) return true;
        return (
          e.message.toLowerCase().includes(term) ||
          (e.symbol ?? "").toLowerCase().includes(term) ||
          (e.position_id ?? "").toLowerCase().includes(term) ||
          e.source.toLowerCase().includes(term)
        );
      })
      .slice()
      .reverse();
  }, [events, levelFilter, kindFilter, search]);

  const counts = useMemo(() => {
    return events.reduce(
      (acc, e) => {
        acc.total++;
        acc[e.level]++;
        if (e.kind === "db_guard_block") acc.guard++;
        return acc;
      },
      { total: 0, debug: 0, info: 0, warn: 0, error: 0, guard: 0 }
    );
  }, [events]);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Mode Events Console
            </CardTitle>
            <CardDescription>
              Live structured logs for Live / Edited / Manual price modes — DB writes, realtime payloads & guardrails.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              {alertsOn ? <Bell className="h-3.5 w-3.5 text-emerald-400" /> : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-muted-foreground">Alerts</span>
              <Switch checked={alertsOn} onCheckedChange={setAlertsOn} />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Auto-scroll</span>
              <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
            </div>
            <Button variant="outline" size="sm" onClick={() => modeLogger.clear()}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
          <Stat label="Total" value={counts.total} />
          <Stat label="Info" value={counts.info} tone="info" />
          <Stat label="Warn" value={counts.warn} tone="warn" />
          <Stat label="Error" value={counts.error} tone="error" />
          <Stat label="Guard blocks" value={counts.guard} tone={counts.guard > 0 ? "warn" : "info"} />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Input
            placeholder="Search symbol / position id / message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm h-9"
          />
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Kind" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[420px] rounded-md border border-border/50 bg-background/40">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No events yet. Trigger a trade edit, reset, or manual close to see live entries.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((e) => (
                <li key={e.id} className="px-3 py-2 text-xs font-mono">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">
                      {format(new Date(e.ts), "HH:mm:ss.SSS")}
                    </span>
                    <Badge variant="outline" className={levelStyle[e.level]}>{e.level}</Badge>
                    <Badge variant="outline" className={kindStyle[e.kind] ?? "bg-muted"}>{e.kind}</Badge>
                    {e.symbol && <span className="text-foreground">{e.symbol}</span>}
                    {e.price_mode && <span className="text-muted-foreground">[{e.price_mode}]</span>}
                    <span className="text-muted-foreground">· {e.source}</span>
                    {(e.level === "error" || e.kind === "db_guard_block") && (
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                  <div className="mt-1 text-foreground/90 break-words">{e.message}</div>
                  {(e.data || e.position_id) && (
                    <div className="mt-1 text-muted-foreground break-all">
                      {e.position_id && <span>pos={e.position_id.slice(0, 8)}… </span>}
                      {e.data && <span>{JSON.stringify(e.data)}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "info" | "warn" | "error" }) {
  const cls =
    tone === "error" ? "text-destructive" :
    tone === "warn" ? "text-amber-400" :
    tone === "info" ? "text-emerald-400" : "text-foreground";
  return (
    <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
