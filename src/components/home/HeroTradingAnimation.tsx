import { useEffect, useMemo, useState } from "react";

/**
 * Premium animated trading background for the hero section.
 * Layers (back -> front):
 *  1. Soft radial spotlights
 *  2. Animated grid with parallax shimmer
 *  3. Depth area + line chart with glowing stroke
 *  4. Live candlestick feed (shifts left)
 *  5. Order-book heat bars on the sides
 *  6. Floating ticker chips with subtle drift
 *  7. Particle "trade" pings
 *  8. Scanline / vignette polish
 */
const HeroTradingAnimation = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, []);

  // Candles streaming right-to-left
  const candles = useMemo(() => {
    const count = 36;
    const arr: { open: number; close: number; high: number; low: number }[] = [];
    let prev = 50;
    for (let i = 0; i < count; i++) {
      const drift =
        Math.sin((i + tick) * 0.55) * 7 +
        Math.cos((i + tick) * 0.27) * 4 +
        (Math.sin(tick * 0.15) * 3);
      const close = Math.max(12, Math.min(88, prev + drift + (Math.random() - 0.5) * 5));
      const open = prev;
      const high = Math.max(open, close) + Math.random() * 5;
      const low = Math.min(open, close) - Math.random() * 5;
      arr.push({ open, close, high, low });
      prev = close;
    }
    return arr;
  }, [tick]);

  const linePoints = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const y =
          50 +
          Math.sin((i + tick * 1.6) * 0.3) * 20 +
          Math.cos((i + tick * 0.9) * 0.6) * 8 +
          Math.sin((i + tick) * 0.12) * 4;
        return `${(i / 59) * 100},${y}`;
      }),
    [tick]
  );

  const linePath = `M ${linePoints.join(" L ")}`;
  const areaPath = `M 0,100 L ${linePoints.join(" L ")} L 100,100 Z`;

  // Order book heat (left = bids, right = asks)
  const heatBars = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        h: 20 + Math.abs(Math.sin((i + tick) * 0.7)) * 60 + Math.random() * 10,
        delay: `${i * 0.08}s`,
      })),
    [tick]
  );

  const tickers = [
    { sym: "BTC/USD", val: "+2.42%", up: true, top: "10%", left: "6%", delay: "0s" },
    { sym: "ETH/USD", val: "+1.18%", up: true, top: "72%", left: "3%", delay: "1.1s" },
    { sym: "XAU/USD", val: "-0.62%", up: false, top: "20%", left: "82%", delay: "0.5s" },
    { sym: "EUR/USD", val: "+0.34%", up: true, top: "78%", left: "80%", delay: "1.7s" },
    { sym: "SOL/USD", val: "+4.21%", up: true, top: "42%", left: "88%", delay: "2.3s" },
    { sym: "USOIL", val: "-1.24%", up: false, top: "55%", left: "1%", delay: "2.9s" },
    { sym: "NAS100", val: "+0.91%", up: true, top: "32%", left: "45%", delay: "1.4s" },
  ];

  // Random trade pings
  const pings = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        top: `${15 + ((i * 37 + tick * 11) % 70)}%`,
        left: `${10 + ((i * 53 + tick * 17) % 80)}%`,
        up: i % 2 === 0,
        delay: `${i * 0.4}s`,
      })),
    [tick]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Radial spotlights */}
      <div
        className="absolute -top-1/4 -left-1/4 w-[60%] h-[60%] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 60%)" }}
      />
      <div
        className="absolute -bottom-1/4 -right-1/4 w-[55%] h-[55%] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.22), transparent 60%)" }}
      />

      {/* Animated grid */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.12]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="hero-grid" width="6.25" height="6.25" patternUnits="userSpaceOnUse">
            <path d="M 6.25 0 L 0 0 0 6.25" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.08" />
          </pattern>
          <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="50%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
          <filter id="hero-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100" height="100" fill="url(#hero-grid)" />
      </svg>

      {/* Area + line chart */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.32]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path d={areaPath} fill="url(#hero-area)" className="transition-all duration-700 ease-out" />
        <path
          d={linePath}
          fill="none"
          stroke="url(#hero-line)"
          strokeWidth="0.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#hero-glow)"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Candlesticks */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full h-2/3 opacity-[0.28]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {candles.map((c, i) => {
          const cw = 100 / candles.length;
          const x = i * cw + cw * 0.18;
          const w = cw * 0.64;
          const bullish = c.close <= c.open;
          const color = bullish ? "hsl(var(--primary))" : "hsl(var(--destructive))";
          const top = Math.min(c.open, c.close);
          const bot = Math.max(c.open, c.close);
          return (
            <g key={i} className="transition-all duration-700 ease-out">
              <line x1={x + w / 2} x2={x + w / 2} y1={c.high} y2={c.low} stroke={color} strokeWidth="0.22" />
              <rect x={x} y={top} width={w} height={Math.max(0.7, bot - top)} fill={color} rx="0.3" />
            </g>
          );
        })}
      </svg>

      {/* Order book heat bars */}
      <div className="absolute left-2 top-1/4 hidden md:flex flex-col gap-1 opacity-50">
        {heatBars.map((b, i) => (
          <div
            key={`bid-${i}`}
            className="h-1.5 rounded-full bg-gradient-to-r from-primary/70 to-transparent transition-all duration-700"
            style={{ width: `${b.h * 1.2}px`, animationDelay: b.delay }}
          />
        ))}
      </div>
      <div className="absolute right-2 top-1/4 hidden md:flex flex-col gap-1 items-end opacity-50">
        {heatBars.map((b, i) => (
          <div
            key={`ask-${i}`}
            className="h-1.5 rounded-full bg-gradient-to-l from-destructive/70 to-transparent transition-all duration-700"
            style={{ width: `${b.h * 1.1}px`, animationDelay: b.delay }}
          />
        ))}
      </div>

      {/* Floating ticker chips */}
      {tickers.map((t) => (
        <div
          key={t.sym}
          className="absolute hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/60 backdrop-blur-md border border-border/70 shadow-md animate-float text-[11px] font-semibold tracking-wide"
          style={{ top: t.top, left: t.left, animationDelay: t.delay }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-foreground/85">{t.sym}</span>
          <span className={t.up ? "text-emerald-500" : "text-red-500"}>
            {t.up ? "▲" : "▼"} {t.val}
          </span>
        </div>
      ))}

      {/* Trade pings */}
      {pings.map((p, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{ top: p.top, left: p.left, animationDelay: p.delay }}
        >
          <span
            className={`absolute inset-0 rounded-full ${p.up ? "bg-emerald-500" : "bg-red-500"} animate-ping opacity-75`}
          />
          <span
            className={`absolute inset-0 rounded-full ${p.up ? "bg-emerald-500" : "bg-red-500"}`}
          />
        </div>
      ))}

      {/* Scanline shimmer */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.05] to-transparent animate-pulse" />

      {/* Soft vignette for focus */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, hsl(var(--background) / 0.55) 100%)",
        }}
      />
    </div>
  );
};

export default HeroTradingAnimation;
