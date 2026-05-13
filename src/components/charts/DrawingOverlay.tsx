import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { DrawingLine, DrawingMode } from "@/hooks/useChartDrawings";
import type { Candle } from "@/components/charts/TradingChart";

interface Props {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  containerRef: React.RefObject<HTMLDivElement>;
  mode: DrawingMode;
  color: string;
  drawings: DrawingLine[];
  setDrawings: React.Dispatch<React.SetStateAction<DrawingLine[]>>;
  candles?: Candle[];
  magnet?: boolean;
}

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#a855f7"];
const HANDLE = 6;
const HIT_RADIUS = 12;

export default function DrawingOverlay({
  chart,
  series,
  containerRef,
  mode,
  color,
  drawings,
  setDrawings,
  candles = [],
  magnet = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<DrawingLine | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<
    | null
    | {
        id: string;
        kind: "body" | "handle";
        handleIdx?: number;
        startTime: number;
        startPrice: number;
        original: { time: number; price: number }[];
      }
  >(null);

  // resize canvas
  useEffect(() => {
    const c = canvasRef.current;
    const cont = containerRef.current;
    if (!c || !cont) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width = cont.clientWidth * dpr;
      c.height = cont.clientHeight * dpr;
      c.style.width = `${cont.clientWidth}px`;
      c.style.height = `${cont.clientHeight}px`;
      const ctx = c.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    ro.observe(cont);
    return () => ro.disconnect();
  }, [containerRef]);

  // deselect when mode changes away from select
  useEffect(() => {
    if (mode !== "select") setSelectedId(null);
  }, [mode]);

  // delete key
  useEffect(() => {
    if (mode !== "select" || !selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        setDrawings((prev) => prev.filter((d) => d.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selectedId, setDrawings]);

  // magnet snap helper
  const snap = (pt: { time: number; price: number }) => {
    if (!magnet || !candles.length) return pt;
    // nearest candle by time
    let nearest = candles[0];
    let best = Math.abs(candles[0].time - pt.time);
    for (const c of candles) {
      const d = Math.abs(c.time - pt.time);
      if (d < best) {
        best = d;
        nearest = c;
      }
    }
    const ohlc = [nearest.open, nearest.high, nearest.low, nearest.close];
    let p = ohlc[0];
    let bestP = Math.abs(ohlc[0] - pt.price);
    for (const v of ohlc) {
      const d = Math.abs(v - pt.price);
      if (d < bestP) {
        bestP = d;
        p = v;
      }
    }
    return { time: nearest.time, price: p };
  };

  // render loop
  useEffect(() => {
    if (!chart || !series) return;
    let raf = 0;
    const render = () => {
      const c = canvasRef.current;
      const cont = containerRef.current;
      if (!c || !cont) {
        raf = requestAnimationFrame(render);
        return;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, cont.clientWidth, cont.clientHeight);

      const ts = chart.timeScale();
      const toX = (time: number) => ts.timeToCoordinate(time as Time);
      const toY = (price: number) => series.priceToCoordinate(price);

      const all = draftRef.current ? [...drawings, draftRef.current] : drawings;

      for (const d of all) {
        const isSel = d.id === selectedId;
        ctx.strokeStyle = d.color;
        ctx.fillStyle = d.color;
        ctx.lineWidth = isSel ? d.lineWidth + 1.5 : d.lineWidth;
        ctx.beginPath();

        if (d.type === "hline" && d.points[0]) {
          const y = toY(d.points[0].price);
          if (y == null) continue;
          ctx.moveTo(0, y);
          ctx.lineTo(cont.clientWidth, y);
          ctx.stroke();
        } else if (d.type === "vline" && d.points[0]) {
          const x = toX(d.points[0].time);
          if (x == null) continue;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, cont.clientHeight);
          ctx.stroke();
        } else if (d.type === "trendline" && d.points.length >= 2) {
          const x1 = toX(d.points[0].time);
          const y1 = toY(d.points[0].price);
          const x2 = toX(d.points[1].time);
          const y2 = toY(d.points[1].price);
          if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (d.type === "rectangle" && d.points.length >= 2) {
          const x1 = toX(d.points[0].time);
          const y1 = toY(d.points[0].price);
          const x2 = toX(d.points[1].time);
          const y2 = toY(d.points[1].price);
          if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
          ctx.globalAlpha = 0.15;
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
          ctx.globalAlpha = 1;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        } else if (d.type === "fib" && d.points.length >= 2) {
          const x1 = toX(d.points[0].time);
          const x2 = toX(d.points[1].time);
          const p1 = d.points[0].price;
          const p2 = d.points[1].price;
          if (x1 == null || x2 == null) continue;
          const left = Math.min(x1, x2);
          const right = Math.max(x1, x2, cont.clientWidth);
          FIB_LEVELS.forEach((lvl, i) => {
            const price = p1 + (p2 - p1) * lvl;
            const y = toY(price);
            if (y == null) return;
            ctx.strokeStyle = FIB_COLORS[i];
            ctx.fillStyle = FIB_COLORS[i];
            ctx.lineWidth = isSel ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            ctx.font = "11px sans-serif";
            ctx.fillText(`${lvl}  ${price.toFixed(2)}`, left + 4, y - 2);
          });
        } else if (d.type === "brush" && d.points.length >= 2) {
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          d.points.forEach((p, i) => {
            const x = toX(p.time);
            const y = toY(p.price);
            if (x == null || y == null) return;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else if (d.type === "text" && d.points[0]) {
          const x = toX(d.points[0].time);
          const y = toY(d.points[0].price);
          if (x == null || y == null) continue;
          ctx.font = isSel ? "bold 13px sans-serif" : "13px sans-serif";
          ctx.fillText(d.text || "Text", x, y);
        } else if (d.type === "ray" && d.points.length >= 2) {
          const x1 = toX(d.points[0].time);
          const y1 = toY(d.points[0].price);
          const x2 = toX(d.points[1].time);
          const y2 = toY(d.points[1].price);
          if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
          // extend to right edge
          const dx = x2 - x1, dy = y2 - y1;
          const W = cont.clientWidth;
          let xe: number = x2 as number, ye: number = y2 as number;
          if (dx !== 0) {
            const t = (W - (x1 as number)) / dx;
            if (t > 1) { xe = W; ye = (y1 as number) + dy * t; }
          }
          ctx.moveTo(x1, y1);
          ctx.lineTo(xe, ye);
          ctx.stroke();
        } else if (d.type === "measure" && d.points.length >= 2) {
          const x1 = toX(d.points[0].time);
          const y1 = toY(d.points[0].price);
          const x2 = toX(d.points[1].time);
          const y2 = toY(d.points[1].price);
          if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
          const up = d.points[1].price >= d.points[0].price;
          const fill = up ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
          const stroke = up ? "#10b981" : "#ef4444";
          ctx.fillStyle = fill;
          ctx.strokeStyle = stroke;
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          const diff = d.points[1].price - d.points[0].price;
          const pct = (diff / d.points[0].price) * 100;
          // approx bars from candle spacing
          let bars = 0;
          if (candles.length >= 2) {
            const step = candles[1].time - candles[0].time || 1;
            bars = Math.round((d.points[1].time - d.points[0].time) / step);
          }
          ctx.fillStyle = stroke;
          ctx.font = "bold 11px sans-serif";
          const txt = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}  ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%  |  ${bars} bars`;
          ctx.fillText(txt, (x1 + x2) / 2 - 80, (y1 + y2) / 2);
        } else if ((d.type === "long" || d.type === "short") && d.points.length >= 2) {
          const x1 = toX(d.points[0].time);
          const y1 = toY(d.points[0].price); // entry
          const x2 = toX(d.points[1].time);
          const y2 = toY(d.points[1].price); // target
          if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
          const entry = d.points[0].price;
          const target = d.points[1].price;
          // auto SL mirrored from entry
          const stopPrice = entry - (target - entry);
          const ys = toY(stopPrice);
          if (ys == null) continue;
          const left = Math.min(x1, x2), right = Math.max(x1, x2);
          const isLong = d.type === "long";
          const profitColor = isLong ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)";
          const lossColor = isLong ? "rgba(239,68,68,0.18)" : "rgba(16,185,129,0.18)";
          // profit zone (entry -> target)
          ctx.fillStyle = profitColor;
          ctx.fillRect(left, Math.min(y1, y2), right - left, Math.abs(y2 - y1));
          // loss zone (entry -> stop)
          ctx.fillStyle = lossColor;
          ctx.fillRect(left, Math.min(y1, ys), right - left, Math.abs(ys - y1));
          // entry line
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(left, y1); ctx.lineTo(right, y1); ctx.stroke();
          // labels
          ctx.fillStyle = "#facc15";
          ctx.font = "bold 11px sans-serif";
          const rr = Math.abs((target - entry) / (entry - stopPrice)).toFixed(2);
          ctx.fillText(`${isLong ? "BUY" : "SELL"}  Entry ${entry.toFixed(2)}  TP ${target.toFixed(2)}  SL ${stopPrice.toFixed(2)}  RR 1:${rr}`, left + 4, Math.min(y1, y2, ys) - 4);
        }

        // selection handles
        if (isSel && d.type !== "brush") {
          ctx.fillStyle = "#3b82f6";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          for (const p of d.points) {
            const hx = toX(p.time);
            const hy = toY(p.price);
            if (hx == null || hy == null) continue;
            ctx.beginPath();
            ctx.rect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      // magnet crosshair tag
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [chart, series, drawings, containerRef, selectedId]);

  // pointer events
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !chart || !series) return;
    if (mode === "cursor") return;

    const ts = chart.timeScale();
    const fromEvt = (e: PointerEvent, doSnap = true) => {
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const time = ts.coordinateToTime(x);
      const price = series.coordinateToPrice(y);
      if (time == null || price == null) return null;
      const pt = { time: Number(time), price: Number(price) };
      return doSnap ? snap(pt) : pt;
    };

    const localXY = (e: PointerEvent) => {
      const rect = c.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // SELECT mode
    if (mode === "select") {
      const onDown = (e: PointerEvent) => {
        const { x: px, y: py } = localXY(e);
        // 1) handle hit on currently selected
        if (selectedId) {
          const sel = drawings.find((d) => d.id === selectedId);
          if (sel) {
            for (let i = 0; i < sel.points.length; i++) {
              const hx = ts.timeToCoordinate(sel.points[i].time as Time);
              const hy = series.priceToCoordinate(sel.points[i].price);
              if (hx == null || hy == null) continue;
              if (Math.hypot(hx - px, hy - py) < HIT_RADIUS) {
                const pt = fromEvt(e, false);
                if (!pt) return;
                c.setPointerCapture(e.pointerId);
                dragRef.current = {
                  id: sel.id,
                  kind: "handle",
                  handleIdx: i,
                  startTime: pt.time,
                  startPrice: pt.price,
                  original: sel.points.map((p) => ({ ...p })),
                };
                return;
              }
            }
          }
        }
        // 2) body hit on any drawing
        for (let i = drawings.length - 1; i >= 0; i--) {
          const d = drawings[i];
          if (hitTest(d, px, py, ts, series)) {
            const pt = fromEvt(e, false);
            if (!pt) return;
            setSelectedId(d.id);
            c.setPointerCapture(e.pointerId);
            dragRef.current = {
              id: d.id,
              kind: "body",
              startTime: pt.time,
              startPrice: pt.price,
              original: d.points.map((p) => ({ ...p })),
            };
            return;
          }
        }
        // 3) miss: deselect
        setSelectedId(null);
      };
      const onMove = (e: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const pt = fromEvt(e, false);
        if (!pt) return;
        const dt = pt.time - drag.startTime;
        const dp = pt.price - drag.startPrice;
        setDrawings((prev) =>
          prev.map((d) => {
            if (d.id !== drag.id) return d;
            if (drag.kind === "handle" && drag.handleIdx != null) {
              const newPoints = drag.original.map((p) => ({ ...p }));
              const target = magnet ? snap(pt) : pt;
              newPoints[drag.handleIdx] = target;
              return { ...d, points: newPoints };
            }
            // body move
            return {
              ...d,
              points: drag.original.map((p) => ({ time: p.time + dt, price: p.price + dp })),
            };
          }),
        );
      };
      const onUp = () => {
        dragRef.current = null;
      };
      c.addEventListener("pointerdown", onDown);
      c.addEventListener("pointermove", onMove);
      c.addEventListener("pointerup", onUp);
      c.addEventListener("pointercancel", onUp);
      return () => {
        c.removeEventListener("pointerdown", onDown);
        c.removeEventListener("pointermove", onMove);
        c.removeEventListener("pointerup", onUp);
        c.removeEventListener("pointercancel", onUp);
      };
    }

    // DRAW modes
    const onDown = (e: PointerEvent) => {
      const pt = fromEvt(e);
      if (!pt) return;
      c.setPointerCapture(e.pointerId);
      const id = `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      if (mode === "eraser") {
        const { x: px, y: py } = localXY(e);
        setDrawings((prev) => {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (hitTest(prev[i], px, py, ts, series)) {
              return prev.filter((_, k) => k !== i);
            }
          }
          return prev;
        });
        return;
      }

      if (mode === "hline" || mode === "vline") {
        setDrawings((prev) => [
          ...prev,
          { id, type: mode, points: [pt], color, lineWidth: 1.5 },
        ]);
        return;
      }

      if (mode === "text") {
        const text = window.prompt("Text:", "Note");
        if (text) {
          setDrawings((prev) => [
            ...prev,
            { id, type: "text", points: [pt], color, lineWidth: 1, text },
          ]);
        }
        return;
      }

      draftRef.current = {
        id,
        type: mode,
        points: mode === "brush" ? [pt] : [pt, pt],
        color,
        lineWidth: mode === "brush" ? 2.5 : 1.5,
      };
    };

    const onMove = (e: PointerEvent) => {
      if (!draftRef.current) return;
      const pt = fromEvt(e);
      if (!pt) return;
      if (mode === "brush") {
        draftRef.current.points.push(pt);
      } else {
        draftRef.current.points[1] = pt;
      }
    };

    const onUp = () => {
      if (draftRef.current) {
        const d = draftRef.current;
        draftRef.current = null;
        setDrawings((prev) => [...prev, d]);
      }
    };

    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    return () => {
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
    };
  }, [chart, series, mode, color, setDrawings, drawings, selectedId, magnet, candles]);

  const interactive = mode !== "cursor";
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        pointerEvents: interactive ? "auto" : "none",
        cursor: mode === "select" ? "default" : interactive ? "crosshair" : "default",
        touchAction: interactive ? "none" : "auto",
      }}
    />
  );
}

// Hit-test a drawing against pixel coords
function hitTest(
  d: DrawingLine,
  px: number,
  py: number,
  ts: ReturnType<IChartApi["timeScale"]>,
  series: ISeriesApi<"Candlestick">,
): boolean {
  const toX = (t: number) => ts.timeToCoordinate(t as Time);
  const toY = (p: number) => series.priceToCoordinate(p);
  const TOL = 6;

  if (d.type === "hline" && d.points[0]) {
    const y = toY(d.points[0].price);
    return y != null && Math.abs(y - py) < TOL;
  }
  if (d.type === "vline" && d.points[0]) {
    const x = toX(d.points[0].time);
    return x != null && Math.abs(x - px) < TOL;
  }
  if ((d.type === "trendline" || d.type === "fib") && d.points.length >= 2) {
    const x1 = toX(d.points[0].time);
    const y1 = toY(d.points[0].price);
    const x2 = toX(d.points[1].time);
    const y2 = toY(d.points[1].price);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return false;
    return distToSegment(px, py, x1, y1, x2, y2) < TOL;
  }
  if (d.type === "rectangle" && d.points.length >= 2) {
    const x1 = toX(d.points[0].time);
    const y1 = toY(d.points[0].price);
    const x2 = toX(d.points[1].time);
    const y2 = toY(d.points[1].price);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return false;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    // edge hit
    const onEdge =
      ((Math.abs(px - minX) < TOL || Math.abs(px - maxX) < TOL) && py >= minY - TOL && py <= maxY + TOL) ||
      ((Math.abs(py - minY) < TOL || Math.abs(py - maxY) < TOL) && px >= minX - TOL && px <= maxX + TOL);
    return onEdge;
  }
  if (d.type === "brush" && d.points.length >= 2) {
    for (let i = 1; i < d.points.length; i++) {
      const x1 = toX(d.points[i - 1].time);
      const y1 = toY(d.points[i - 1].price);
      const x2 = toX(d.points[i].time);
      const y2 = toY(d.points[i].price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
      if (distToSegment(px, py, x1, y1, x2, y2) < TOL) return true;
    }
    return false;
  }
  if (d.type === "text" && d.points[0]) {
    const x = toX(d.points[0].time);
    const y = toY(d.points[0].price);
    if (x == null || y == null) return false;
    return px >= x - 4 && px <= x + 80 && py >= y - 14 && py <= y + 4;
  }
  return false;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
