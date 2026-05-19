import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Plus, Trash2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  availableBalance: string;
}

interface SavedMethod {
  id: string;
  method_type: "bank" | "upi";
  label: string | null;
  account_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  upi_id: string | null;
  is_default: boolean;
}

const WithdrawalModal = ({ open, onOpenChange, onSuccess, availableBalance }: WithdrawalModalProps) => {
  const [withdrawalMethod, setWithdrawalMethod] = useState<"bank" | "upi">("bank");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [addingNew, setAddingNew] = useState(false);
  const [saveForLater, setSaveForLater] = useState(true);

  // Form fields
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");

  const loadSavedMethods = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("user_payment_methods")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    const methods = (data || []) as SavedMethod[];
    setSavedMethods(methods);
    if (methods.length > 0) {
      const def = methods.find((m) => m.is_default) || methods[0];
      setSelectedMethodId(def.id);
      setWithdrawalMethod(def.method_type);
      setAddingNew(false);
    } else {
      setAddingNew(true);
    }
  };

  useEffect(() => {
    if (open) {
      loadSavedMethods();
    }
  }, [open]);

  const resetFields = () => {
    setAccountName("");
    setAccountNumber("");
    setIfscCode("");
    setBankName("");
    setUpiId("");
  };

  const handleDeleteMethod = async (id: string) => {
    const { error } = await supabase.from("user_payment_methods").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Removed", description: "Saved method deleted" });
    loadSavedMethods();
  };

  const handleSetDefault = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_payment_methods").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("user_payment_methods").update({ is_default: true }).eq("id", id);
    loadSavedMethods();
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if (parseFloat(amount) > parseFloat(availableBalance)) {
      toast({ title: "Insufficient Balance", description: "Withdrawal amount exceeds available balance", variant: "destructive" });
      return;
    }

    let accountDetails: Record<string, string> = {};
    let methodType: "bank" | "upi" = withdrawalMethod;

    if (!addingNew && selectedMethodId) {
      const m = savedMethods.find((x) => x.id === selectedMethodId);
      if (!m) {
        toast({ title: "Error", description: "Select a saved method", variant: "destructive" });
        return;
      }
      methodType = m.method_type;
      accountDetails = m.method_type === "bank"
        ? { accountName: m.account_name || "", accountNumber: m.account_number || "", ifscCode: m.ifsc_code || "", bankName: m.bank_name || "" }
        : { upiId: m.upi_id || "" };
    } else {
      if (withdrawalMethod === "bank") {
        if (!accountName || !accountNumber || !ifscCode || !bankName) {
          toast({ title: "Error", description: "Please fill in all bank details", variant: "destructive" });
          return;
        }
        accountDetails = { accountName, accountNumber, ifscCode, bankName };
      } else {
        if (!upiId) {
          toast({ title: "Error", description: "Please enter UPI ID", variant: "destructive" });
          return;
        }
        accountDetails = { upiId };
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Save new method if requested
      if (addingNew && saveForLater) {
        const payload: any = {
          user_id: user.id,
          method_type: withdrawalMethod,
          is_default: savedMethods.length === 0,
        };
        if (withdrawalMethod === "bank") {
          payload.account_name = accountName;
          payload.account_number = accountNumber;
          payload.ifsc_code = ifscCode;
          payload.bank_name = bankName;
          payload.label = `${bankName} •••${accountNumber.slice(-4)}`;
        } else {
          payload.upi_id = upiId;
          payload.label = upiId;
        }
        await supabase.from("user_payment_methods").insert(payload);
      }

      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: user.id,
        amount: parseFloat(amount),
        currency: "USD",
        withdrawal_method: methodType,
        account_details: accountDetails,
      });

      if (error) throw error;

      toast({ title: "Success!", description: "Withdrawal request submitted successfully." });

      setAmount("");
      resetFields();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Available Balance: <span className="font-bold">${availableBalance}</span>
            </AlertDescription>
          </Alert>

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
            <p className="text-xs text-muted-foreground">Minimum withdrawal: $1.00</p>
          </div>

          {/* Saved methods list */}
          {savedMethods.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Saved Withdrawal Methods</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddingNew((v) => !v);
                    setSelectedMethodId("");
                    resetFields();
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {addingNew ? "Use saved" : "Add new"}
                </Button>
              </div>

              {!addingNew && (
                <>
                  <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a saved method" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedMethods.filter((m) => m.method_type === "bank").length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Bank Accounts</SelectLabel>
                          {savedMethods
                            .filter((m) => m.method_type === "bank")
                            .map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.label}{m.is_default ? " • Default" : ""}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      )}
                      {savedMethods.filter((m) => m.method_type === "upi").length > 0 && (
                        <SelectGroup>
                          <SelectLabel>UPI</SelectLabel>
                          {savedMethods
                            .filter((m) => m.method_type === "upi")
                            .map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.label}{m.is_default ? " • Default" : ""}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>

                  {selectedMethodId && (() => {
                    const m = savedMethods.find((x) => x.id === selectedMethodId);
                    if (!m) return null;
                    return (
                      <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {m.method_type}
                          </span>
                          <span className="font-medium">{m.label}</span>
                          {m.is_default && (
                            <span className="text-xs text-accent flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" /> Default
                            </span>
                          )}
                        </div>
                        {m.method_type === "bank" ? (
                          <p className="text-xs text-muted-foreground">
                            {m.account_name} • A/C ••{m.account_number?.slice(-4)} • IFSC {m.ifsc_code}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">UPI: {m.upi_id}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          {!m.is_default && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleSetDefault(m.id)}>
                              <Star className="h-3.5 w-3.5 mr-1" /> Set default
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteMethod(m.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

            </div>
          )}

          {/* Add new method form */}
          {addingNew && (
            <>
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

              {withdrawalMethod === "bank" && (
                <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
                  <h3 className="font-semibold">Bank Account Details</h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="accName">Account Holder Name</Label>
                      <Input id="accName" placeholder="Enter account holder name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accNumber">Account Number</Label>
                      <Input id="accNumber" placeholder="Enter account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ifsc">IFSC Code</Label>
                      <Input id="ifsc" placeholder="Enter IFSC code" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank">Bank Name</Label>
                      <Input id="bank" placeholder="Enter bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {withdrawalMethod === "upi" && (
                <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
                  <h3 className="font-semibold">UPI Details</h3>
                  <div className="space-y-2">
                    <Label htmlFor="upiIdInput">UPI ID</Label>
                    <Input id="upiIdInput" placeholder="yourname@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                    <p className="text-xs text-muted-foreground">e.g., yourname@paytm, yourname@phonepe</p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox id="saveForLater" checked={saveForLater} onCheckedChange={(c) => setSaveForLater(Boolean(c))} />
                <Label htmlFor="saveForLater" className="cursor-pointer text-sm">
                  Save these details for future withdrawals
                </Label>
              </div>
            </>
          )}

          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Important:</strong> Withdrawal requests are processed within 24-48 hours. Please ensure your account details are correct to avoid delays.
            </AlertDescription>
          </Alert>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={loading || !amount || parseFloat(amount) < 1 || (!addingNew && !selectedMethodId)}
          >
            {loading ? "Submitting..." : "Submit Withdrawal Request"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WithdrawalModal;
