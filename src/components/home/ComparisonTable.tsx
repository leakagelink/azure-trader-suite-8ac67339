import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Trophy } from "lucide-react";

const features = [
  { feature: "Minimum Deposit", us: "$10", others: "$100 - $500" },
  { feature: "Max Leverage", us: "1:500", others: "1:100" },
  { feature: "Withdrawal Time", us: "Instant - 24h", others: "3-7 days" },
  { feature: "Spread (EUR/USD)", us: "0.1 pips", others: "1.5 - 3 pips" },
  { feature: "Commission per Trade", us: true, others: false, customUs: "Zero", customOthers: "$5 - $10" },
  { feature: "Crypto + Forex + Commodities", us: true, others: false },
  { feature: "Mobile Trading App", us: true, others: true },
  { feature: "24/7 Customer Support", us: true, others: false },
  { feature: "Demo Account", us: true, others: true },
  { feature: "Deposit Bonus", us: "Up to 100%", others: "0% - 25%" },
  { feature: "INR Direct Deposit", us: true, others: false },
  { feature: "Hidden Fees", us: false, others: true },
];

const renderCell = (val: any, isUs: boolean) => {
  if (typeof val === "boolean") {
    return val ? (
      <Check className={`h-5 w-5 mx-auto ${isUs ? "text-green-300" : "text-green-300/70"}`} />
    ) : (
      <X className={`h-5 w-5 mx-auto ${isUs ? "text-red-300" : "text-red-300/70"}`} />
    );
  }
  return (
    <span className={`text-sm font-semibold ${isUs ? "text-white" : "text-white/70"}`}>{val}</span>
  );
};

export const ComparisonTable = () => {
  return (
    <section className="py-12 sm:py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 sm:mb-14">
          <Badge variant="outline" className="mb-3 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/30">
            <Trophy className="h-3 w-3 mr-1" /> Why Choose Us
          </Badge>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3">
            TradixoFX vs <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Other Brokers</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            See how we compare against typical brokers in the industry
          </p>
        </div>

        <Card className="max-w-4xl mx-auto overflow-hidden bg-primary text-white border-primary/40">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/10 border-b border-white/20">
                  <th className="text-left p-4 text-sm font-bold text-white">Feature</th>
                  <th className="text-center p-4 min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <Badge className="bg-white text-primary border-0 font-bold">
                        <Trophy className="h-3 w-3 mr-1" /> TradixoFX
                      </Badge>
                    </div>
                  </th>
                  <th className="text-center p-4 min-w-[140px] text-sm font-semibold text-white/80">
                    Other Brokers
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr
                    key={i}
                    className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                      i % 2 === 0 ? "bg-white/[0.03]" : ""
                    }`}
                  >
                    <td className="p-4 text-sm font-medium text-white">{f.feature}</td>
                    <td className="p-4 text-center bg-white/10">
                      {renderCell((f as any).customUs ?? f.us, true)}
                    </td>
                    <td className="p-4 text-center">
                      {renderCell((f as any).customOthers ?? f.others, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
};
