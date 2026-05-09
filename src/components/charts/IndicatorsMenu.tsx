import { useState } from "react";
import { Activity, Plus, X } from "lucide-react";
import { DEFAULTS, LABEL, type IndicatorConfig, type IndicatorKind } from "@/lib/indicators";

interface Props {
  indicators: IndicatorConfig[];
  setIndicators: React.Dispatch<React.SetStateAction<IndicatorConfig[]>>;
}

const KINDS: IndicatorKind[] = ["sma", "ema", "bb", "vwap", "rsi", "stoch", "macd", "atr"];

export default function IndicatorsMenu({ indicators, setIndicators }: Props) {
  const [open, setOpen] = useState(false);

  const add = (kind: IndicatorKind) => {
    const def = DEFAULTS[kind];
    setIndicators((prev) => [
      ...prev,
      {
        id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind,
        ...def,
      } as IndicatorConfig,
    ]);
  };

  const remove = (id: string) =>
    setIndicators((prev) => prev.filter((i) => i.id !== id));

  const updateField = (id: string, patch: Partial<IndicatorConfig>) =>
    setIndicators((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted/40"
      >
        <Activity className="h-3.5 w-3.5" />
        Indicators
        {indicators.length > 0 && (
          <span className="rounded-md bg-primary/20 px-1.5 text-[10px] text-primary">
            {indicators.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-border/60 bg-popover p-3 shadow-2xl">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Add indicator</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => add(k)}
                  className="flex items-center gap-1 rounded-md border border-border/40 bg-card/40 px-2 py-1 text-xs hover:bg-muted/40"
                >
                  <Plus className="h-3 w-3" /> {LABEL[k]}
                </button>
              ))}
            </div>
            {indicators.length > 0 && (
              <>
                <div className="mb-2 text-xs font-semibold text-muted-foreground">Active</div>
                <div className="space-y-2">
                  {indicators.map((ind) => (
                    <div
                      key={ind.id}
                      className="flex items-center gap-2 rounded-md border border-border/40 bg-card/40 p-2"
                    >
                      <input
                        type="color"
                        value={ind.color || "#888"}
                        onChange={(e) => updateField(ind.id, { color: e.target.value })}
                        className="h-5 w-5 cursor-pointer rounded border-none bg-transparent"
                      />
                      <div className="flex-1 text-xs font-semibold">{LABEL[ind.kind]}</div>
                      {ind.kind === "macd" ? (
                        <div className="flex gap-1">
                          {(["fast", "slow", "signal"] as const).map((f) => (
                            <input
                              key={f}
                              type="number"
                              value={(ind as any)[f] ?? ""}
                              onChange={(e) =>
                                updateField(ind.id, { [f]: Number(e.target.value) } as any)
                              }
                              className="w-12 rounded bg-muted/40 px-1 py-0.5 text-center text-xs outline-none"
                              title={f}
                            />
                          ))}
                        </div>
                      ) : (
                        <>
                          <input
                            type="number"
                            value={ind.period ?? ""}
                            onChange={(e) => updateField(ind.id, { period: Number(e.target.value) })}
                            className="w-14 rounded bg-muted/40 px-1 py-0.5 text-center text-xs outline-none"
                            title="period"
                          />
                          {ind.kind === "bb" && (
                            <input
                              type="number"
                              step="0.1"
                              value={ind.stdDev ?? ""}
                              onChange={(e) =>
                                updateField(ind.id, { stdDev: Number(e.target.value) })
                              }
                              className="w-12 rounded bg-muted/40 px-1 py-0.5 text-center text-xs outline-none"
                              title="std dev"
                            />
                          )}
                        </>
                      )}
                      <button
                        onClick={() => remove(ind.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
