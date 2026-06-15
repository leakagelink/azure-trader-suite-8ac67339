import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Download, RefreshCcw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface TradeRow {
  id: string;
  user_id: string;
  symbol: string;
  position_type: "long" | "short";
  amount: number;
  leverage: number;
  margin: number;
  entry_price: number;
  current_price: number;
  close_price: number | null;
  pnl: number;
  status: "open" | "closed";
  price_mode: string | null;
  opened_at: string;
  closed_at: string | null;
  full_name?: string | null;
  email?: string | null;
  client_id?: string | null;
}

type SortKey = "opened_at" | "closed_at" | "pnl" | "amount" | "leverage" | "symbol" | "user";
type SortDir = "asc" | "desc";

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const formatDuration = (open: string, close?: string | null) => {
  const start = new Date(open).getTime();
  const end = close ? new Date(close).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

export function AdminTradeHistory() {
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "long" | "short">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "live" | "manual" | "edited">("all");
  const [sortKey, setSortKey] = useState<SortKey>("opened_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchAll = async () => {
    try {
      setLoading(true);
      const { data: positions, error } = await supabase
        .from("positions")
        .select("*")
        .order("opened_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(new Set((positions || []).map((p: any) => p.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, client_id")
        .in("id", userIds);
      const pmap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const enriched: TradeRow[] = (positions || []).map((p: any) => ({
        ...p,
        full_name: pmap.get(p.user_id)?.full_name ?? null,
        email: pmap.get(p.user_id)?.email ?? null,
        client_id: pmap.get(p.user_id)?.client_id ?? null,
      }));
      setRows(enriched);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load trade history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("admin-trade-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let arr = [...rows];
    if (statusFilter !== "all") arr = arr.filter((r) => r.status === statusFilter);
    if (typeFilter !== "all") arr = arr.filter((r) => r.position_type === typeFilter);
    if (sourceFilter !== "all") arr = arr.filter((r) => (r.price_mode || "live") === sourceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (r) =>
          r.symbol?.toLowerCase().includes(q) ||
          r.full_name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.client_id?.toLowerCase().includes(q),
      );
    }
    arr.sort((a, b) => {
      let av: any;
      let bv: any;
      switch (sortKey) {
        case "opened_at":
          av = new Date(a.opened_at).getTime();
          bv = new Date(b.opened_at).getTime();
          break;
        case "closed_at":
          av = a.closed_at ? new Date(a.closed_at).getTime() : 0;
          bv = b.closed_at ? new Date(b.closed_at).getTime() : 0;
          break;
        case "pnl":
          av = Number(a.pnl) || 0;
          bv = Number(b.pnl) || 0;
          break;
        case "amount":
          av = Number(a.amount) || 0;
          bv = Number(b.amount) || 0;
          break;
        case "leverage":
          av = a.leverage;
          bv = b.leverage;
          break;
        case "symbol":
          av = a.symbol;
          bv = b.symbol;
          break;
        case "user":
          av = (a.full_name || a.email || "").toLowerCase();
          bv = (b.full_name || b.email || "").toLowerCase();
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, search, statusFilter, typeFilter, sourceFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportCSV = () => {
    const header = [
      "Opened At",
      "Closed At",
      "Duration",
      "User",
      "Client ID",
      "Email",
      "Symbol",
      "Side",
      "Lot/Amount",
      "Leverage",
      "Margin (USD)",
      "Entry Price",
      "Exit/Current Price",
      "PnL (USD)",
      "Status",
      "Source",
    ];
    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      lines.push(
        [
          formatDateTime(r.opened_at),
          formatDateTime(r.closed_at),
          formatDuration(r.opened_at, r.closed_at),
          r.full_name || "—",
          r.client_id || "—",
          r.email || "—",
          r.symbol,
          r.position_type === "long" ? "BUY" : "SELL",
          r.amount,
          `${r.leverage}x`,
          (Number(r.margin) || 0).toFixed(2),
          (Number(r.entry_price) || 0).toFixed(4),
          (Number(r.close_price ?? r.current_price) || 0).toFixed(4),
          (Number(r.pnl) || 0).toFixed(2),
          r.status,
          r.price_mode || "live",
        ]
          .map(escape)
          .join(","),
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const totalPnL = filtered.reduce((s, r) => s + (Number(r.pnl) || 0), 0);
  const openCount = filtered.filter((r) => r.status === "open").length;
  const closedCount = filtered.filter((r) => r.status === "closed").length;

  const sourceBadge = (mode: string | null) => {
    const m = (mode || "live").toLowerCase();
    if (m === "manual") return <Badge variant="secondary">Manual</Badge>;
    if (m === "edited") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">Edited</Badge>;
    return <Badge variant="outline">Live</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Complete Trade History</CardTitle>
            <CardDescription>
              Every user trade with full timestamps, side, leverage, prices, PnL & source.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search user, email, client ID or symbol…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sides</SelectItem>
                <SelectItem value="long">Buy</SelectItem>
                <SelectItem value="short">Sell</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v: any) => setSourceFilter(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="edited">Edited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Trades</p>
            <p className="text-xl font-bold">{filtered.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="text-xl font-bold text-primary">{openCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Closed</p>
            <p className="text-xl font-bold">{closedCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Net PnL</p>
            <p className={`text-xl font-bold ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
              {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("opened_at")}>
                    Opened At <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("closed_at")}>
                    Closed At <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("user")}>
                    User <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("symbol")}>
                    Symbol <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("amount")}>
                    Lot <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("leverage")}>
                    Lev <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Exit/Current</TableHead>
                <TableHead className="text-right">
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort("pnl")}>
                    PnL <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                    No trades found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const isLong = r.position_type === "long";
                  const exit = r.close_price ?? r.current_price;
                  const pnl = Number(r.pnl) || 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.opened_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.closed_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDuration(r.opened_at, r.closed_at)}
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{r.full_name || "—"}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {r.client_id || "—"} · {r.email || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{r.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isLong
                              ? "border-green-500/40 text-green-700 bg-green-500/10"
                              : "border-red-500/40 text-red-700 bg-red-500/10"
                          }
                        >
                          {isLong ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {isLong ? "BUY" : "SELL"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.amount}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.leverage}x</TableCell>
                      <TableCell className="text-right tabular-nums">${(Number(r.margin) || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${(Number(r.entry_price) || 0).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">${(Number(exit) || 0).toFixed(4)}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-semibold ${
                          pnl >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "open" ? "default" : "secondary"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>{sourceBadge(r.price_mode)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminTradeHistory;
