import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon, Gift, Sparkles, Lock, Clock, CheckCircle, XCircle, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DepositModal from "@/components/DepositModal";
import WithdrawalModal from "@/components/WithdrawalModal";
import PageShell, { glassCardClass } from "@/components/PageShell";

interface WalletBalance {
  currency: string;
  balance: string;
  lockedBalance: string;
  icon: string;
}

const Wallet = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [walletData, setWalletData] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState(0.012);
  const [offerSettings, setOfferSettings] = useState({
    bonusEnabled: false,
    bonusPercentage: "0",
    minAmount: "0",
    maxAmount: "0",
    bonusMax: "0",
    offerTitle: "",
  });

  const fetchOfferSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("setting_key, setting_value");
      if (error) throw error;
      if (data) {
        const settings: any = {};
        data.forEach((setting) => { settings[setting.setting_key] = setting.setting_value; });
        setOfferSettings({
          bonusEnabled: settings.deposit_bonus_enabled === 'true',
          bonusPercentage: settings.deposit_bonus_percentage || "0",
          minAmount: settings.deposit_min_amount || "0",
          maxAmount: settings.deposit_max_amount || "0",
          bonusMax: settings.deposit_bonus_max || "0",
          offerTitle: settings.deposit_offer_title || "",
        });
        if (settings.exchange_rate) setExchangeRate(parseFloat(settings.exchange_rate));
      }
    } catch (error) {
      console.error("Error fetching offer settings:", error);
    }
  };

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: wallets, error: walletsError } = await supabase
        .from("user_wallets").select("*").eq("user_id", user.id);
      if (walletsError) throw walletsError;

      const usdWallet = wallets?.find(w => w.currency === "USD");
      const inrWallet = wallets?.find(w => w.currency === "INR");

      const formattedWallets: WalletBalance[] = [{
        currency: "USD",
        balance: usdWallet ? Number(usdWallet.balance).toFixed(2) : "0.00",
        lockedBalance: inrWallet ? Number(inrWallet.locked_balance || 0).toFixed(2) : "0.00",
        icon: "$",
      }];
      setWalletData(formattedWallets);

      const { data: txs, error: txsError } = await supabase
        .from("wallet_transactions").select("*").eq("user_id", user.id)
        .in("type", ["deposit", "withdrawal"]).order("created_at", { ascending: false }).limit(10);
      if (txsError) throw txsError;
      setTransactions(txs?.map((tx) => ({
        type: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        amount: `${tx.type === "deposit" ? "+" : "-"}$${Number(tx.amount).toFixed(2)}`,
        date: new Date(tx.created_at).toLocaleDateString(),
        status: tx.status,
      })) || []);

      const { data: tradeTxs } = await supabase
        .from("wallet_transactions").select("*").eq("user_id", user.id)
        .eq("type", "trade").order("created_at", { ascending: false }).limit(10);
      setTradeHistory(tradeTxs?.map((tx) => ({
        type: "Trade",
        amount: Number(tx.amount) >= 0 ? `+$${Number(tx.amount).toFixed(2)}` : `-$${Math.abs(Number(tx.amount)).toFixed(2)}`,
        date: new Date(tx.created_at).toLocaleDateString(),
        status: tx.status,
        isProfit: Number(tx.amount) >= 0,
      })) || []);

      const { data: deposits, error: depositsError } = await supabase
        .from("deposit_requests").select("*").eq("user_id", user.id).is("deleted_at", null)
        .order("created_at", { ascending: false }).limit(10);

      if (depositsError) throw depositsError;
      setDepositHistory(deposits || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
    fetchOfferSettings();
  }, []);

  return (
    <PageShell title="My Wallet" subtitle="Manage your funds and transactions" icon={WalletIcon} maxWidth="6xl">
      {/* Deposit Offer Banner */}
      {offerSettings.bonusEnabled && (
        <Card className="mb-6 sm:mb-8 p-5 sm:p-6 bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground overflow-hidden relative border-0 shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.5)] animate-fade-in">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-2 left-10 text-4xl">🎁</div>
            <div className="absolute top-4 right-20 text-3xl">💰</div>
            <div className="absolute bottom-2 left-1/4 text-3xl">🎉</div>
            <div className="absolute bottom-3 right-10 text-4xl">✨</div>
          </div>
          <div className="absolute -inset-px bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  {offerSettings.offerTitle || "Special Offer"}
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </h3>
                <p className="text-white/90 text-xs sm:text-sm">Limited time offer - Don't miss out!</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mt-4 border border-white/20">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold mb-1">{offerSettings.bonusPercentage}% DEPOSIT BONUS</p>
                <p className="text-white/90 text-xs sm:text-sm">
                  Deposit between <span className="font-bold">${offerSettings.minAmount} - ${offerSettings.maxAmount}</span> and get <span className="font-bold">{offerSettings.bonusPercentage}% extra</span>!
                </p>
                <div className="flex items-center justify-center gap-2 sm:gap-4 mt-3 text-xs sm:text-sm flex-wrap">
                  <span className="bg-white/20 px-3 py-1 rounded-full">Min: ${offerSettings.minAmount}</span>
                  <span className="bg-white/20 px-3 py-1 rounded-full">Max Bonus: ${offerSettings.bonusMax}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Pro Desktop Layout: 2-column grid on lg+ */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-6 xl:gap-8">
       <div>
      {/* Wallet Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {walletData.map((wallet, index) => (
          <Card key={index} className={`${glassCardClass} p-5 sm:p-6 group hover:scale-[1.02] transition-all duration-500`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors duration-500" />
            <div className="relative flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground font-medium">{wallet.currency} Available</span>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-accent/30 flex items-center justify-center text-xl font-bold text-primary">
                {wallet.icon}
              </div>
            </div>
            <div className="relative text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-400 bg-clip-text text-transparent">
              ${wallet.balance}
            </div>
            <p className="relative text-xs text-muted-foreground mt-2">Available for trading & withdrawal</p>
          </Card>
        ))}
        {walletData.map((wallet, index) => (
          <Card key={`locked-${index}`} className={`${glassCardClass} p-5 sm:p-6 group hover:scale-[1.02] transition-all duration-500`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent" />
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent/10 rounded-full blur-2xl group-hover:bg-accent/20 transition-colors duration-500" />
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" />
                <span className="text-sm text-muted-foreground font-medium">INR Locked</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 border border-accent/30 flex items-center justify-center text-xl font-bold text-accent">
                ₹
              </div>
            </div>
            <div className="relative text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-400 bg-clip-text text-transparent">
              ₹{wallet.lockedBalance}
            </div>
            <p className="relative text-xs text-muted-foreground mt-2">Pending broker verification</p>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <Card
          className={`${glassCardClass} p-5 sm:p-6 cursor-pointer group hover:scale-[1.02] hover:shadow-2xl transition-all duration-500`}
          onClick={() => setDepositModalOpen(true)}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/5 group-hover:from-emerald-500/5 group-hover:to-emerald-500/15 transition-all duration-500" />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <ArrowDownLeft className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Deposit Funds</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Add money to your wallet</p>
            </div>
          </div>
        </Card>
        <Card
          className={`${glassCardClass} p-5 sm:p-6 cursor-pointer group hover:scale-[1.02] hover:shadow-2xl transition-all duration-500`}
          onClick={() => setWithdrawalModalOpen(true)}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/5 group-hover:from-blue-500/5 group-hover:to-blue-500/15 transition-all duration-500" />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <ArrowUpRight className="h-7 w-7 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Withdraw Funds</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Transfer money out</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Withdrawal History Link */}
      <Card
        className={`${glassCardClass} p-4 mb-6 cursor-pointer group hover:scale-[1.01] transition-all duration-300`}
        onClick={() => navigate("/withdrawal-history")}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500/15 to-blue-600/15 border border-blue-500/30 flex items-center justify-center">
              <History className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Withdrawal History</h3>
              <p className="text-xs text-muted-foreground">View pending, approved & rejected withdrawals</p>
            </div>
          </div>
          <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </Card>

      {/* Recent Transactions */}
      <Card className={`${glassCardClass} p-5 sm:p-6 mb-6 sm:mb-8`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <h2 className="text-lg sm:text-xl font-bold mb-5 flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-accent/30">
            <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Recent Transactions
          </span>
        </h2>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No deposit or withdrawal transactions yet</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 transition-all duration-300 hover:scale-[1.01]">
                <div>
                  <div className="font-semibold text-sm sm:text-base">{transaction.type}</div>
                  <div className="text-xs text-muted-foreground">{transaction.date}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${transaction.type === "Deposit" ? "text-emerald-500" : "text-red-500"}`}>{transaction.amount}</div>
                  <div className="text-xs text-muted-foreground capitalize">{transaction.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
      {/* Deposit History */}
      <Card className={`${glassCardClass} p-5 sm:p-6 mb-6`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <h2 className="text-lg sm:text-xl font-bold mb-5 flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-accent/30">
            <History className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Deposit History
          </span>
        </h2>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading deposit history...</p>
        ) : depositHistory.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No deposit requests yet</p>
        ) : (
          <div className="space-y-3">
            {depositHistory.map((deposit, index) => {
              const inrAmount = Number(deposit.amount);
              const usdAmount = deposit.currency === "INR" ? inrAmount * exchangeRate : inrAmount;
              const statusIcon = deposit.status === "approved" ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : deposit.status === "rejected" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <Clock className="h-4 w-4 text-amber-500" />
              );

              return (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 transition-all duration-300 hover:scale-[1.01]">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      deposit.status === "approved" ? "bg-emerald-500/15 border border-emerald-500/30" :
                      deposit.status === "rejected" ? "bg-red-500/15 border border-red-500/30" :
                      "bg-amber-500/15 border border-amber-500/30"
                    }`}>
                      {statusIcon}
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                        Deposit
                        <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full capitalize font-semibold ${
                          deposit.status === "approved" ? "bg-emerald-500/15 text-emerald-500" :
                          deposit.status === "rejected" ? "bg-red-500/15 text-red-500" :
                          deposit.status === "locked" ? "bg-amber-500/15 text-amber-500" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {deposit.status === "locked" ? "Payment Credit" : deposit.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(deposit.created_at).toLocaleDateString()} • {deposit.payment_method?.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm sm:text-base">
                      {deposit.currency === "INR" ? "₹" : "$"}{inrAmount.toLocaleString()}
                    </div>
                    {deposit.currency === "INR" && (
                      <div className="text-xs text-emerald-500">
                        ≈ ${usdAmount.toFixed(2)} USD
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </div>
      </div>

      <DepositModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
        onSuccess={fetchWalletData}
      />
      <WithdrawalModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        onSuccess={fetchWalletData}
        availableBalance={walletData.find(w => w.currency === "USD")?.balance || "0.00"}
      />
    </PageShell>
  );
};

export default Wallet;
