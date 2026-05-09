import PageShell from "@/components/PageShell";
import { Zap } from "lucide-react";
import { LiveSignals } from "@/components/home/LiveSignals";

const Signals = () => {
  return (
    <PageShell
      title="Premium Signals"
      subtitle="Broker-curated trade ideas with entry, take profit & stop loss"
      icon={Zap}
      maxWidth="6xl"
    >
      <div className="-mx-3 sm:-mx-4">
        <LiveSignals authenticated />
      </div>
    </PageShell>
  );
};

export default Signals;
