import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ApiEvent {
  date: string;
  country: string;
  event: string;
  currency?: string;
  impact: string;
  actual?: number | null;
  previous?: number | null;
  estimate?: number | null;
  unit?: string;
}

interface DisplayEvent {
  dateLabel: string;
  timeLabel: string;
  country: string;
  flag: string;
  event: string;
  forecast: string;
  previous: string;
  actual: string;
}

const countryFlag: Record<string, string> = {
  US: "🇺🇸", EU: "🇪🇺", UK: "🇬🇧", GB: "🇬🇧", JP: "🇯🇵", IN: "🇮🇳",
  CN: "🇨🇳", DE: "🇩🇪", CA: "🇨🇦", AU: "🇦🇺", FR: "🇫🇷", IT: "🇮🇹",
};

const formatVal = (v: number | null | undefined, unit?: string) => {
  if (v === null || v === undefined) return "—";
  return `${v}${unit || ""}`;
};

export const EconomicCalendar = () => {
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("fetch-economic-calendar");
        if (fnError) throw fnError;

        const apiEvents: ApiEvent[] = data?.events || [];
        const mapped: DisplayEvent[] = apiEvents.map((e) => {
          const d = new Date(e.date);
          return {
            dateLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            timeLabel: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }),
            country: e.country,
            flag: countryFlag[e.country?.toUpperCase()] || "🌐",
            event: e.event,
            forecast: formatVal(e.estimate, e.unit),
            previous: formatVal(e.previous, e.unit),
            actual: formatVal(e.actual, e.unit),
          };
        });
        setEvents(mapped);
      } catch (err) {
        console.error("Failed to fetch economic calendar:", err);
        setError("Could not load events");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <section className="py-12 sm:py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 sm:mb-12">
          <Badge variant="outline" className="mb-3 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/30">
            <Calendar className="h-3 w-3 mr-1" /> Economic Calendar
          </Badge>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3">
            This Week's <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">High Impact Events</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Live data from global markets. All times in IST.
          </p>
        </div>

        <Card className="max-w-5xl mx-auto overflow-hidden bg-card/60 backdrop-blur border-border/40">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading this week's events…</span>
            </div>
          ) : error || events.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              {error || "No high-impact events scheduled this week."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40 border-b border-border/40">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Time</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Country</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Event</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Impact</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Forecast</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Previous</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-xs sm:text-sm whitespace-nowrap">{e.dateLabel}</td>
                      <td className="p-3 text-xs sm:text-sm font-mono">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {e.timeLabel}
                        </div>
                      </td>
                      <td className="p-3 text-xs sm:text-sm whitespace-nowrap">
                        <span className="text-lg mr-1">{e.flag}</span>
                        <span className="hidden sm:inline">{e.country}</span>
                      </td>
                      <td className="p-3 text-xs sm:text-sm font-medium">{e.event}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-[10px] uppercase">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          High
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-xs font-mono hidden sm:table-cell">{e.forecast}</td>
                      <td className="p-3 text-right text-xs font-mono text-muted-foreground hidden sm:table-cell">{e.previous}</td>
                      <td className="p-3 text-right text-xs font-mono text-primary hidden md:table-cell">{e.actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
};
