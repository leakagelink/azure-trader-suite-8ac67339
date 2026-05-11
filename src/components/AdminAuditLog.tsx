import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, RefreshCw, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  position_id: string;
  user_id: string;
  changed_by: string | null;
  change_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  symbol: string | null;
  position_type: string | null;
  source: string | null;
  created_at: string;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
  client_id: string | null;
}

const typeColor: Record<string, string> = {
  price_mode: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  current_price: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pnl: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  entry_price: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  stop_loss: "bg-red-500/15 text-red-400 border-red-500/30",
  take_profit: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  status: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  close_price: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const sourceColor: Record<string, string> = {
  broker: "bg-primary/15 text-primary border-primary/30",
  user: "bg-muted text-muted-foreground border-border",
  system: "bg-secondary text-secondary-foreground border-border",
};

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("position_audit_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("audit fetch", error);
      setLoading(false);
      return;
    }
    const rows = (data || []) as unknown as AuditEntry[];
    setEntries(rows);

    const ids = Array.from(
      new Set(rows.flatMap((r) => [r.user_id, r.changed_by]).filter(Boolean) as string[])
    );
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, client_id")
        .in("id", ids);
      const map: Record<string, ProfileMini> = {};
      (profs || []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("audit-log-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "position_audit_log" },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter !== "all" && e.change_type !== typeFilter) return false;
      if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
      if (!q) return true;
      const owner = profiles[e.user_id];
      const actor = e.changed_by ? profiles[e.changed_by] : null;
      const hay = [
        e.symbol,
        e.position_id,
        e.change_type,
        e.field_name,
        e.old_value,
        e.new_value,
        owner?.full_name,
        owner?.email,
        owner?.client_id,
        actor?.full_name,
        actor?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, profiles, search, typeFilter, sourceFilter]);

  const formatVal = (v: string | null) => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isNaN(n) && /^-?\d/.test(v)) {
      return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
    return v;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Trade Audit Log
            </CardTitle>
            <CardDescription>
              Every Broker edit and price-mode change with timestamp + old/new values
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder="Search symbol, user, value…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="price_mode">Price mode</SelectItem>
                <SelectItem value="current_price">Current price</SelectItem>
                <SelectItem value="pnl">PnL</SelectItem>
                <SelectItem value="entry_price">Entry price</SelectItem>
                <SelectItem value="stop_loss">Stop loss</SelectItem>
                <SelectItem value="take_profit">Take profit</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="close_price">Close price</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="broker">Broker</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading audit log…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No audit entries match your filters.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Old → New</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const owner = profiles[e.user_id];
                  const actor = e.changed_by ? profiles[e.changed_by] : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(e.created_at), "dd MMM yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{e.symbol || "—"}</span>
                          {e.position_type && (
                            <span
                              className={`text-[10px] uppercase ${
                                e.position_type === "long" ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {e.position_type}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeColor[e.change_type] || ""}>
                          {e.change_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-mono">
                          <span className="text-muted-foreground line-through">
                            {formatVal(e.old_value)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground font-semibold">
                            {formatVal(e.new_value)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {owner ? (
                          <div className="flex flex-col">
                            <span>{owner.full_name || owner.email}</span>
                            {owner.client_id && (
                              <span className="text-muted-foreground">{owner.client_id}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {actor ? actor.full_name || actor.email : <span className="text-muted-foreground">System</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={sourceColor[e.source || "system"] || ""}>
                          {e.source || "system"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
