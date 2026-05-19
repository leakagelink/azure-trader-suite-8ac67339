import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Landmark, Smartphone, Pencil, Trash2, Star, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName?: string | null;
}

const AdminUserPaymentMethodsDialog = ({ open, onOpenChange, userId, userName }: Props) => {
  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SavedMethod>>({});

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_payment_methods")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setMethods((data || []) as SavedMethod[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setEditingId(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const startEdit = (m: SavedMethod) => {
    setEditingId(m.id);
    setForm({ ...m });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const label =
      form.method_type === "bank"
        ? `${form.bank_name || ""} •••${(form.account_number || "").slice(-4)}`
        : form.upi_id || "";
    const { error } = await supabase
      .from("user_payment_methods")
      .update({
        account_name: form.account_name ?? null,
        account_number: form.account_number ?? null,
        ifsc_code: form.ifsc_code ?? null,
        bank_name: form.bank_name ?? null,
        upi_id: form.upi_id ?? null,
        label,
      })
      .eq("id", editingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Updated");
    cancelEdit();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this saved method?")) return;
    const { error } = await supabase.from("user_payment_methods").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    load();
  };

  const handleSetDefault = async (id: string) => {
    if (!userId) return;
    await supabase.from("user_payment_methods").update({ is_default: false }).eq("user_id", userId);
    const { error } = await supabase.from("user_payment_methods").update({ is_default: true }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Default updated");
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saved Payment Methods</DialogTitle>
          <DialogDescription>
            {userName ? `For ${userName}` : "User saved bank accounts and UPI IDs"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No saved methods.</p>
        ) : (
          <div className="space-y-3">
            {methods.map((m) => (
              <div key={m.id} className="p-4 border border-border rounded-lg bg-muted/20">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {m.method_type === "bank" ? (
                      <Landmark className="h-4 w-4 text-primary" />
                    ) : (
                      <Smartphone className="h-4 w-4 text-primary" />
                    )}
                    <Badge variant="outline" className="capitalize">{m.method_type}</Badge>
                    {m.is_default && (
                      <Badge className="bg-accent text-accent-foreground">
                        <Star className="h-3 w-3 mr-1 fill-current" /> Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {editingId === m.id ? (
                      <>
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="h-4 w-4 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {!m.is_default && (
                          <Button size="sm" variant="ghost" onClick={() => handleSetDefault(m.id)} title="Set default">
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => startEdit(m)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(m.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {editingId === m.id ? (
                  m.method_type === "bank" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Account Holder</Label>
                        <Input value={form.account_name || ""} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Account Number</Label>
                        <Input value={form.account_number || ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">IFSC</Label>
                        <Input value={form.ifsc_code || ""} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Bank Name</Label>
                        <Input value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">UPI ID</Label>
                      <Input value={form.upi_id || ""} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
                    </div>
                  )
                ) : (
                  <div className="text-sm space-y-1">
                    <div className="font-semibold">{m.label}</div>
                    {m.method_type === "bank" ? (
                      <div className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <div><strong>Name:</strong> {m.account_name}</div>
                        <div><strong>A/C:</strong> {m.account_number}</div>
                        <div><strong>IFSC:</strong> {m.ifsc_code}</div>
                        <div><strong>Bank:</strong> {m.bank_name}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">UPI: {m.upi_id}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUserPaymentMethodsDialog;
