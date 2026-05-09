import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle, Zap, ArrowLeft, CreditCard, Clock, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type DepositMode = "select" | "instant" | "manual";
type InstantStep = "amount" | "qr" | "confirm";

const COUNTDOWN_DURATION = 10 * 60; // 10 minutes in seconds
const AUTO_LOCK_THRESHOLD = 7 * 60 + 30; // 7:30 elapsed = 2:30 remaining

const DepositModal = ({ open, onOpenChange, onSuccess }: DepositModalProps) => {
  const [depositMode, setDepositMode] = useState<DepositMode>("select");
  const [instantStep, setInstantStep] = useState<InstantStep>("amount");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "netbanking">("upi");
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const [isAutoLocked, setIsAutoLocked] = useState(false);
  const [depositRequestId, setDepositRequestId] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  // Payment details from database
  const [upiId, setUpiId] = useState("coingoldfx@upi");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [bankDetails, setBankDetails] = useState({
    accountName: "CoinGoldFX Account",
    accountNumber: "1234567890",
    ifsc: "BANK0001234",
    bankName: "Demo Bank",
  });
  
  // Exchange rate and bonus settings
  const [exchangeRate, setExchangeRate] = useState(0.012);
  const [bonusSettings, setBonusSettings] = useState({
    enabled: false,
    percentage: 0,
    minAmount: 0,
    maxAmount: 999999,
    bonusMax: 0,
  });

  useEffect(() => {
    if (open) {
      fetchPaymentSettings();
      // Reset state when modal opens
      setDepositMode("select");
      setInstantStep("amount");
      setAmount("");
      setTransactionId("");
      setCountdown(COUNTDOWN_DURATION);
      setIsAutoLocked(false);
      setDepositRequestId(null);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }
  }, [open]);

  // Countdown timer effect
  useEffect(() => {
    if (instantStep === "qr" && countdown > 0 && !isAutoLocked) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          const newValue = prev - 1;
          
          // Check if we've reached the auto-lock threshold (2:30 remaining)
          if (newValue <= (COUNTDOWN_DURATION - AUTO_LOCK_THRESHOLD) && !isAutoLocked) {
            handleAutoLock();
          }
          
          if (newValue <= 0) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            return 0;
          }
          return newValue;
        });
      }, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    }
  }, [instantStep, isAutoLocked]);

  const handleAutoLock = async () => {
    if (isAutoLocked || !depositRequestId) return;
    
    setIsAutoLocked(true);
    
    try {
      // Call the lock_deposit function (deposits are in INR)
      const { error } = await supabase.rpc('lock_deposit', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_amount: parseFloat(amount),
        p_currency: 'INR',
        p_deposit_id: depositRequestId
      });

      if (error) throw error;

      toast({
        title: "Payment Locked!",
        description: "Your deposit is now in locked balance. Admin will verify and confirm.",
      });
    } catch (error: any) {
      console.error("Error locking deposit:", error);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("*");

      if (error) throw error;

      if (data) {
        const settings: any = {};
        data.forEach((setting) => {
          settings[setting.setting_key] = setting.setting_value;
        });

        setUpiId(settings.upi_id || "coingoldfx@upi");
        setQrCodeUrl(settings.qr_code_url || "");
        setBankDetails({
          accountName: settings.account_name || "CoinGoldFX Account",
          accountNumber: settings.account_number || "1234567890",
          ifsc: settings.ifsc_code || "BANK0001234",
          bankName: settings.bank_name || "Demo Bank",
        });
        
        // Set exchange rate
        if (settings.exchange_rate) {
          setExchangeRate(parseFloat(settings.exchange_rate));
        }
        
        // Set bonus settings
        setBonusSettings({
          enabled: settings.deposit_bonus_enabled === 'true',
          percentage: parseFloat(settings.deposit_bonus_percentage || "0"),
          minAmount: parseFloat(settings.deposit_min_amount || "0"),
          maxAmount: parseFloat(settings.deposit_max_amount || "999999"),
          bonusMax: parseFloat(settings.deposit_bonus_max || "0"),
        });
      }
    } catch (error) {
      console.error("Error fetching payment settings:", error);
    }
  };
  
  // Calculate USD conversion preview
  const calculateUsdPreview = (inrAmount: number) => {
    const usdAmount = inrAmount * exchangeRate;
    let bonusAmount = 0;
    
    if (bonusSettings.enabled && usdAmount >= bonusSettings.minAmount && usdAmount <= bonusSettings.maxAmount) {
      bonusAmount = usdAmount * (bonusSettings.percentage / 100);
      if (bonusAmount > bonusSettings.bonusMax) {
        bonusAmount = bonusSettings.bonusMax;
      }
    }
    
    return {
      usdAmount,
      bonusAmount,
      totalAmount: usdAmount + bonusAmount,
    };
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Details copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartQRPayment = async () => {
    if (!amount || parseFloat(amount) <= 0 || parseFloat(amount) > 25000) {
      toast({
        title: "Invalid Amount",
        description: "Please enter amount between ₹1 and ₹25,000",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create deposit request immediately (store in INR, will convert to USD on approval)
      const { data, error } = await supabase.from("deposit_requests").insert({
        user_id: user.id,
        amount: parseFloat(amount),
        currency: "INR",
        payment_method: "upi",
        transaction_id: `QR_${Date.now()}`, // Temporary transaction ID
      }).select().single();

      if (error) throw error;

      setDepositRequestId(data.id);
      setInstantStep("qr");
      setCountdown(COUNTDOWN_DURATION);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!amount || !transactionId) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // For instant deposit, update the existing request with transaction ID
      if (depositMode === "instant" && depositRequestId) {
        const { error } = await supabase
          .from("deposit_requests")
          .update({ transaction_id: transactionId })
          .eq('id', depositRequestId);

        if (error) throw error;
      } else {
        // For manual deposit, create new request (store in INR, will convert to USD on approval)
        const { error } = await supabase.from("deposit_requests").insert({
          user_id: user.id,
          amount: parseFloat(amount),
          currency: "INR",
          payment_method: depositMode === "instant" ? "upi" : paymentMethod,
          transaction_id: transactionId,
        });

        if (error) throw error;
      }

      toast({
        title: "Success!",
        description: isAutoLocked 
          ? "Transaction ID submitted. Your deposit is in locked balance awaiting admin confirmation."
          : "Deposit request submitted successfully. Awaiting admin approval.",
      });

      setAmount("");
      setTransactionId("");
      setDepositMode("select");
      setInstantStep("amount");
      setIsAutoLocked(false);
      setDepositRequestId(null);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    if (depositMode === "instant") {
      if (instantStep === "qr" || instantStep === "confirm") {
        setInstantStep("amount");
        setIsAutoLocked(false);
        setDepositRequestId(null);
      } else {
        setDepositMode("select");
      }
    } else {
      setDepositMode("select");
    }
  };

  // Mode Selection Screen
  const renderModeSelection = () => (
    <div className="space-y-4 py-6">
      <div 
        className="p-4 border-2 border-primary/50 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 cursor-pointer hover:border-primary transition-all"
        onClick={() => setDepositMode("instant")}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Quick QR Deposit</h3>
            <p className="text-sm text-muted-foreground">Scan QR & pay up to ₹25,000</p>
          </div>
          <div className="text-primary text-2xl">→</div>
        </div>
      </div>

      <div 
        className="p-4 border border-border rounded-xl bg-card/50 cursor-pointer hover:border-primary/50 transition-all"
        onClick={() => setDepositMode("manual")}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Manual Deposit</h3>
            <p className="text-sm text-muted-foreground">UPI / QR Code / Net Banking</p>
          </div>
          <div className="text-muted-foreground text-2xl">→</div>
        </div>
      </div>
    </div>
  );

  // Instant Deposit - Amount Step
  const renderInstantAmount = () => (
    <div className="space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      
      <div className="text-center">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">Quick QR Deposit</h3>
        <p className="text-muted-foreground text-sm">Pay up to ₹25,000 via QR scan</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instant-amount">Amount (INR)</Label>
        <Input
          id="instant-amount"
          type="number"
          placeholder="Enter amount (max ₹25,000)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          max="25000"
          className="text-xl h-14 text-center font-semibold"
        />
        <p className="text-xs text-muted-foreground text-center">Maximum limit: ₹25,000</p>
      </div>

      {/* USD Conversion Preview */}
      {amount && parseFloat(amount) > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">You will receive</p>
            <div className="text-2xl font-bold text-green-600">
              ${calculateUsdPreview(parseFloat(amount)).totalAmount.toFixed(2)} USD
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-center items-center gap-2">
                <span>₹{parseFloat(amount).toLocaleString()}</span>
                <span>→</span>
                <span>${calculateUsdPreview(parseFloat(amount)).usdAmount.toFixed(2)}</span>
              </div>
              {bonusSettings.enabled && calculateUsdPreview(parseFloat(amount)).bonusAmount > 0 && (
                <div className="text-green-600 font-medium">
                  + ${calculateUsdPreview(parseFloat(amount)).bonusAmount.toFixed(2)} bonus ({bonusSettings.percentage}%)
                </div>
              )}
              <div className="text-[10px] opacity-70">
                Rate: 1 INR = {exchangeRate} USD
              </div>
            </div>
          </div>
        </div>
      )}

      <Button
        className="w-full h-12"
        onClick={handleStartQRPayment}
        disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > 25000 || loading}
      >
        {loading ? "Creating..." : "Show Payment QR"}
      </Button>
    </div>
  );

  // Instant Deposit - QR with Countdown
  const renderQRWithCountdown = () => {
    const isLowTime = countdown <= 150; // Less than 2:30 remaining
    
    return (
      <div className="space-y-6 py-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        {/* Amount Display with USD Preview */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-1">Amount to Pay</p>
          <p className="text-3xl font-bold text-primary">₹{parseFloat(amount).toLocaleString()}</p>
          <div className="mt-2 p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 inline-block">
            <p className="text-xs text-muted-foreground mb-1">You will receive</p>
            <p className="text-lg font-bold text-green-600">
              ${calculateUsdPreview(parseFloat(amount)).totalAmount.toFixed(2)} USD
            </p>
            {bonusSettings.enabled && calculateUsdPreview(parseFloat(amount)).bonusAmount > 0 && (
              <p className="text-xs text-green-600">
                (incl. ${calculateUsdPreview(parseFloat(amount)).bonusAmount.toFixed(2)} bonus)
              </p>
            )}
          </div>
        </div>

        {/* Countdown Timer */}
        <div className={`text-center p-4 rounded-xl ${isLowTime ? 'bg-destructive/10' : 'bg-muted/50'}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {isAutoLocked ? (
              <Lock className="h-5 w-5 text-green-500" />
            ) : (
              <Clock className={`h-5 w-5 ${isLowTime ? 'text-destructive' : 'text-muted-foreground'}`} />
            )}
            <span className={`text-2xl font-mono font-bold ${isLowTime ? 'text-destructive' : ''}`}>
              {formatTime(countdown)}
            </span>
          </div>
          {isAutoLocked ? (
            <p className="text-sm text-green-600 font-medium">
              ✓ Payment Credit
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isLowTime ? "Payment will auto-lock soon!" : "Complete payment before timer expires"}
            </p>
          )}
        </div>

        {/* QR Code */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Payment QR Code" className="w-[200px] h-[200px] object-contain" />
              ) : (
                <QRCodeSVG 
                  value={`upi://pay?pa=${upiId}&pn=CoinGoldFX&am=${amount}&cu=INR`} 
                  size={200} 
                />
              )}
            </div>
          </div>
          
          {/* UPI App Icons */}
          <div className="text-sm text-muted-foreground mb-3">Pay directly via:</div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => {
                const upiLink = `phonepe://pay?pa=${upiId}&pn=CoinGoldFX&am=${amount}&cu=INR`;
                window.location.href = upiLink;
              }}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="h-11 w-11 rounded-full bg-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-base">P</span>
              </div>
              <span className="text-xs text-muted-foreground">PhonePe</span>
            </button>
            
            <button
              onClick={() => {
                const upiLink = `gpay://upi/pay?pa=${upiId}&pn=CoinGoldFX&am=${amount}&cu=INR`;
                window.location.href = upiLink;
              }}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="h-11 w-11 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                <span className="font-bold text-base" style={{ background: 'linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
              </div>
              <span className="text-xs text-muted-foreground">GPay</span>
            </button>
            
            <button
              onClick={() => {
                const upiLink = `paytmmp://pay?pa=${upiId}&pn=CoinGoldFX&am=${amount}&cu=INR`;
                window.location.href = upiLink;
              }}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="h-11 w-11 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white font-bold text-base">₹</span>
              </div>
              <span className="text-xs text-muted-foreground">Paytm</span>
            </button>
            
            <button
              onClick={() => {
                const upiLink = `upi://pay?pa=${upiId}&pn=CoinGoldFX&am=${amount}&cu=INR`;
                window.location.href = upiLink;
              }}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="h-11 w-11 rounded-full bg-green-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">UPI</span>
              </div>
              <span className="text-xs text-muted-foreground">Other</span>
            </button>
          </div>
        </div>

        {isAutoLocked && (
          <Button
            className="w-full h-12"
            onClick={() => {
              onOpenChange(false);
              onSuccess();
            }}
          >
            Done
          </Button>
        )}
      </div>
    );
  };

  // Manual Deposit (Original Flow)
  const renderManualDeposit = () => (
    <div className="space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      {/* Amount Input */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (INR)</Label>
        <Input
          id="amount"
          type="number"
          placeholder="Enter amount in INR"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          step="1"
        />
      </div>

      {/* USD Conversion Preview */}
      {amount && parseFloat(amount) > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">You will receive</p>
            <div className="text-2xl font-bold text-green-600">
              ${calculateUsdPreview(parseFloat(amount)).totalAmount.toFixed(2)} USD
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-center items-center gap-2">
                <span>₹{parseFloat(amount).toLocaleString()}</span>
                <span>→</span>
                <span>${calculateUsdPreview(parseFloat(amount)).usdAmount.toFixed(2)}</span>
              </div>
              {bonusSettings.enabled && calculateUsdPreview(parseFloat(amount)).bonusAmount > 0 && (
                <div className="text-green-600 font-medium">
                  + ${calculateUsdPreview(parseFloat(amount)).bonusAmount.toFixed(2)} bonus ({bonusSettings.percentage}%)
                </div>
              )}
              <div className="text-[10px] opacity-70">
                Rate: 1 INR = {exchangeRate} USD
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Selection */}
      <div className="space-y-3">
        <Label>Select Payment Method</Label>
        <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="upi" id="upi" />
            <Label htmlFor="upi" className="cursor-pointer">UPI / QR Code</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="netbanking" id="netbanking" />
            <Label htmlFor="netbanking" className="cursor-pointer">Net Banking</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Payment Details */}
      {paymentMethod === "upi" ? (
        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
          <div className="text-center">
            <h3 className="font-semibold mb-3">Scan QR Code</h3>
            <div className="flex justify-center mb-4">
              <div className="bg-white p-4 rounded-lg">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Payment QR Code" className="w-[200px] h-[200px] object-contain" />
                ) : (
                  <QRCodeSVG value={`upi://pay?pa=${upiId}&pn=CoinGoldFX&cu=INR`} size={200} />
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground mb-2">Or use UPI ID:</div>
            <div className="flex items-center justify-center gap-2">
              <code className="bg-background px-3 py-2 rounded">{upiId}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(upiId)}
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/20">
          <h3 className="font-semibold">Bank Transfer Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Name:</span>
              <span className="font-medium">{bankDetails.accountName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Account Number:</span>
              <div className="flex items-center gap-2">
                <code className="bg-background px-2 py-1 rounded text-xs">{bankDetails.accountNumber}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(bankDetails.accountNumber)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IFSC Code:</span>
              <span className="font-medium">{bankDetails.ifsc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank Name:</span>
              <span className="font-medium">{bankDetails.bankName}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transaction ID Input */}
      <div className="space-y-2">
        <Label htmlFor="transactionId">Transaction ID / UTR Number</Label>
        <Input
          id="transactionId"
          placeholder="Enter your transaction ID or UTR number"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Enter the transaction reference number from your payment
        </p>
      </div>

      {/* Submit Button */}
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={loading || !amount || !transactionId}
      >
        {loading ? "Submitting..." : "Submit Deposit Request"}
      </Button>
    </div>
  );

  const renderContent = () => {
    if (depositMode === "select") {
      return renderModeSelection();
    }
    
    if (depositMode === "instant") {
      switch (instantStep) {
        case "amount":
          return renderInstantAmount();
        case "qr":
          return renderQRWithCountdown();
        default:
          return renderInstantAmount();
      }
    }
    
    return renderManualDeposit();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {depositMode === "select" ? "Deposit Funds" : 
             depositMode === "instant" ? "Quick QR Deposit" : "Manual Deposit"}
          </SheetTitle>
          <SheetDescription>
            {depositMode === "select" ? "Choose your preferred deposit method" :
             depositMode === "instant" ? "Scan QR & pay up to ₹25,000" :
             "Complete payment and submit transaction details"}
          </SheetDescription>
        </SheetHeader>

        {renderContent()}
      </SheetContent>
    </Sheet>
  );
};

export default DepositModal;