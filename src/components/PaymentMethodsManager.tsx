import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, Plus, Pencil, Trash2, Star, Landmark, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { glassCardClass } from "@/components/PageShell";

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

const emptyForm = {
  method_type: "bank" as "bank" | "upi",
  account_name: "",
  account_number: "",
  ifsc_code: "",
  bank_name: "",
  upi_id: "",
};

const PaymentMethodsManager = () => {
  const { user } = useAuth();
  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchMethods = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_payment_methods")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load payment methods");
    } else {
      setMethods((data || []) as SavedMethod[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: SavedMethod) => {
    setEditingId(m.id);
    setForm({
      method_type: m.method_type,
      account_name: m.account_name || "",
      account_number: m.account_number || "",
      ifsc_code: m.ifsc_code || "",
      bank_name: m.bank_name || "",
      upi_id: m.upi_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (form.method_type === "bank") {
      if (!form.account_name || !form.account_number || !form.ifsc_code || !form.bank_name) {
        toast.error("Please fill all bank fields");
        return;
      }
    } else {
      if (!form.upi_id) {
        toast.error("Please enter UPI ID");
        return;
      }
    }

    setSaving(true);
    try {
      const label =
        form.method_type === "bank"
          ? `${form.bank_name} •••${form.account_number.slice(-4)}`
          : form.upi_id;

      if (editingId) {
        const { error } = await supabase
          .from("user_payment_methods")
          .update({
            method_type: form.method_type,
            account_name: form.method_type === "bank" ? form.account_name : null,
            account_number: form.method_type === "bank" ? form.account_number : null,
            ifsc_code: form.method_type === "bank" ? form.ifsc_code : null,
            bank_name: form.method_type === "bank" ? form.bank_name : null,
            upi_id: form.method_type === "upi" ? form.upi_id : null,
            label,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Payment method updated");
      } else {
        const { error } = await supabase.from("user_payment_methods").insert({
          user_id: user.id,
          method_type: form.method_type,
          account_name: form.method_type === "bank" ? form.account_name : null,
          account_number: form.method_type === "bank" ? form.account_number : null,
          ifsc_code: form.method_type === "bank" ? form.ifsc_code : null,
          bank_name: form.method_type === "bank" ? form.bank_name : null,
          upi_id: form.method_type === "upi" ? form.upi_id : null,
          label,
          is_default: methods.length === 0,
        });
        if (error) throw error;
        toast.success("Payment method added");
      }
      setDialogOpen(false);
      fetchMethods();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this payment method?")) return;
    const { error } = await supabase.from("user_payment_methods").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    fetchMethods();
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("user_payment_methods").update({ is_default: false }).eq("user_id", user.id);
    const { error } = await supabase.from("user_payment_methods").update({ is_default: true }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Default method updated");
    fetchMethods();
  };

  return (
    <Card className={`${glassCardClass} p-5 mb-5`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      <div className="relative flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Withdrawal Methods
          </span>
        </h3>
        <Button size="sm" onClick={openAdd} className="rounded-xl">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="relative">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : methods.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No saved methods yet. Add a bank account or UPI to speed up withdrawals.
          </div>
        ) : (
          <div className="space-y-3">
            {methods.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  {m.method_type === "bank" ? (
                    <Landmark className="h-5 w-5 text-primary" />
                  ) : (
                    <Smartphone className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {m.method_type}
                    </span>
                    <span className="font-semibold text-sm truncate">{m.label}</span>
                    {m.is_default && (
                      <span className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 text-accent font-semibold">
                        <Star className="h-3 w-3 fill-current" /> Default
                      </span>
                    )}
                  </div>
                  {m.method_type === "bank" ? (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {m.account_name} • A/C ••{m.account_number?.slice(-4)} • IFSC {m.ifsc_code}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">UPI ID</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!m.is_default && (
                    <Button variant="ghost" size="icon" onClick={() => handleSetDefault(m.id)} title="Set default">
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Method Type</Label>
              <RadioGroup
                value={form.method_type}
                onValueChange={(v: any) => setForm({ ...form, method_type: v })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bank" id="m-bank" />
                  <Label htmlFor="m-bank" className="cursor-pointer">Bank</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upi" id="m-upi" />
                  <Label htmlFor="m-upi" className="cursor-pointer">UPI</Label>
                </div>
              </RadioGroup>
            </div>

            {form.method_type === "bank" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Account Holder Name</Label>
                  <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Number</Label>
                  <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>IFSC Code</Label>
                  <Input value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bank Name</Label>
                  <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>UPI ID</Label>
                <Input
                  placeholder="yourname@upi"
                  value={form.upi_id}
                  onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Add Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PaymentMethodsManager;
