import { useState } from "react";
import { Bell, Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import type { PriceAlert } from "@/hooks/usePriceAlerts";

interface Props {
  symbol: string;
  currentPrice?: number;
  alerts: PriceAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
}

export default function AlertsMenu({ symbol, currentPrice, alerts, setAlerts }: Props) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [dir, setDir] = useState<"above" | "below">("above");

  const add = () => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    setAlerts((prev) => [
      ...prev,
      {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        symbol,
        price: p,
        direction: dir,
        triggered: false,
        createdAt: Date.now(),
      },
    ]);
    setPrice("");
  };

  const remove = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));
  const reset = (id: string) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, triggered: false } : a)));

  const active = alerts.filter((a) => !a.triggered).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted/40"
      >
        <Bell className="h-3.5 w-3.5" />
        Alerts
        {active > 0 && (
          <span className="rounded-md bg-amber-500/20 px-1.5 text-[10px] text-amber-400">{active}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-border/60 bg-popover p-3 shadow-2xl">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">
              New alert {currentPrice ? `(now ${currentPrice.toFixed(2)})` : ""}
            </div>
            <div className="mb-3 flex items-center gap-1.5">
              <button
                onClick={() => setDir("above")}
                className={`flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-xs ${
                  dir === "above" ? "bg-emerald-500/20 text-emerald-300" : "bg-card/40"
                }`}
              >
                <ArrowUp className="h-3 w-3" /> Above
              </button>
              <button
                onClick={() => setDir("below")}
                className={`flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-xs ${
                  dir === "below" ? "bg-red-500/20 text-red-300" : "bg-card/40"
                }`}
              >
                <ArrowDown className="h-3 w-3" /> Below
              </button>
              <input
                type="number"
                step="any"
                placeholder="Price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="ml-auto w-24 rounded-md border border-border/40 bg-muted/40 px-2 py-1 text-xs outline-none"
              />
              <button
                onClick={add}
                className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {alerts.length > 0 ? (
              <div className="space-y-1.5">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2 rounded-md border border-border/40 p-2 text-xs ${
                      a.triggered ? "bg-muted/20 opacity-60" : "bg-card/40"
                    }`}
                  >
                    {a.direction === "above" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 text-red-400" />
                    )}
                    <span className="font-semibold">{a.price.toFixed(2)}</span>
                    {a.triggered && (
                      <span className="rounded bg-amber-500/20 px-1.5 text-[10px] text-amber-300">
                        triggered
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      {a.triggered && (
                        <button
                          onClick={() => reset(a.id)}
                          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50"
                        >
                          reset
                        </button>
                      )}
                      <button
                        onClick={() => remove(a.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 text-center text-xs text-muted-foreground">No alerts yet</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
