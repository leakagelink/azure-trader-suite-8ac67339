import { useEffect, useState } from "react";
import { Clock, Lock } from "lucide-react";
import { getMarketStatus, formatDuration, type MarketConfig, type MarketCategory } from "@/lib/marketSettings";

interface Props {
  category: MarketCategory;
  config: MarketConfig;
  variant?: "banner" | "inline";
  className?: string;
}

/**
 * Shows a clear "market closed" notice with a live countdown until the next
 * open (when disabled by hours) or a permanent disabled badge (when the Broker
 * has switched the market off entirely). Returns null when the market is open.
 */
export const MarketClosedBanner = ({ category, config, variant = "banner", className = "" }: Props) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const status = getMarketStatus(config, now);
  if (status.open) return null;

  const label = category.charAt(0).toUpperCase() + category.slice(1);
  const isDisabled = status.reason === "disabled";
  const Icon = isDisabled ? Lock : Clock;

  const base =
    variant === "banner"
      ? "flex items-start sm:items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm"
      : "flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold";

  return (
    <div className={`${base} ${className}`} role="status" aria-live="polite">
      <Icon className={variant === "banner" ? "h-4 w-4 sm:h-5 sm:w-5 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
      <div className="flex-1 min-w-0">
        <div className={variant === "banner" ? "text-sm sm:text-base font-bold" : "font-bold"}>
          {label} market {isDisabled ? "disabled" : "closed"}
        </div>
        {variant === "banner" && (
          <div className="text-xs sm:text-sm opacity-90 mt-0.5">
            {isDisabled ? (
              <>Trading has been turned off by the Broker.</>
            ) : (
              <>
                Trading hours {config.hoursStart} – {config.hoursEnd}
                {status.opensInMs != null && (
                  <> · Opens in <span className="font-mono font-bold">{formatDuration(status.opensInMs)}</span></>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketClosedBanner;
