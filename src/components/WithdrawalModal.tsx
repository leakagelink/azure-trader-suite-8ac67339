import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  availableBalance: string;
}

const WithdrawalModal = ({ open, onOpenChange, onSuccess, availableBalance }: WithdrawalModalProps) => {
  const [withdrawalMethod, setWithdrawalMethod] = useState<"bank" | "upi">("bank");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Bank account details
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");

  // UPI details
  const [upiId, setUpiId] = useState("");

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(amount) > parseFloat(availableBalance)) {
      toast({
        title: "Insufficient Balance",
        description: "Withdrawal amount exceeds available balance",
        variant: "destructive",
      });
      return;
    }

    // Validate fields based on method
    if (withdrawalMethod === "bank") {
      if (!accountName || !accountNumber || !ifscCode || !bankName) {
        toast({
          title: "Error",
          description: "Please fill in all bank details",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!upiId) {
        toast({
          title: "Error",
          description: "Please enter UPI ID",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const accountDetails = withdrawalMethod === "bank" 
        ? { accountName, accountNumber, ifscCode, bankName }
        : { upiId };

      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: user.id,
        amount: parseFloat(amount),
        currency: "USD",
        withdrawal_method: withdrawalMethod,
        account_details: accountDetails,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Withdrawal request submitted successfully. Awaiting admin approval.",
      });

      // Reset form
      setAmount("");
      setAccountName("");
      setAccountNumber("");
      setIfscCode("");
      setBankName("");
      setUpiId("");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Withdraw Funds</SheetTitle>
          <SheetDescription>Request a withdrawal to your bank account or UPI</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Available Balance Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Available Balance: <span className="font-bold">${availableBalance}</span>
            </AlertDescription>
          </Alert>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="withdrawAmount">Withdrawal Amount (USD)</Label>
            <Input
              id="withdrawAmount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="0.01"
              max={availableBalance}
            />
            <p className="text-xs text-muted-foreground">
              Minimum withdrawal: $1.00
            </p>
          </div>

          {/* Withdrawal Method Selection */}
          <div className="space-y-3">
            <Label>Select Withdrawal Method</Label>
            <RadioGroup value={withdrawalMethod} onValueChange={(value: any) => setWithdrawalMethod(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bank" id="bank" />
                <Label htmlFor="bank" className="cursor-pointer">Bank Transfer</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="upi" id="upi" />
                <Label htmlFor="upi" className="cursor-pointer">UPI Transfer</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Bank Account Details */}
          {withdrawalMethod === "bank" && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
              <h3 className="font-semibold">Bank Account Details</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="accName">Account Holder Name</Label>
                  <Input
                    id="accName"
                    placeholder="Enter account holder name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accNumber">Account Number</Label>
                  <Input
                    id="accNumber"
                    placeholder="Enter account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifsc">IFSC Code</Label>
                  <Input
                    id="ifsc"
                    placeholder="Enter IFSC code"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank">Bank Name</Label>
                  <Input
                    id="bank"
                    placeholder="Enter bank name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* UPI Details */}
          {withdrawalMethod === "upi" && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
              <h3 className="font-semibold">UPI Details</h3>
              <div className="space-y-2">
                <Label htmlFor="upiIdInput">UPI ID</Label>
                <Input
                  id="upiIdInput"
                  placeholder="yourname@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your registered UPI ID (e.g., yourname@paytm, yourname@phonepe)
                </p>
              </div>
            </div>
          )}

          {/* Important Notice */}
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Important:</strong> Withdrawal requests are processed within 24-48 hours. 
              Please ensure your account details are correct to avoid delays.
            </AlertDescription>
          </Alert>

          {/* Submit Button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={loading || !amount || parseFloat(amount) < 1}
          >
            {loading ? "Submitting..." : "Submit Withdrawal Request"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WithdrawalModal;
