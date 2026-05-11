import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Loader2, Zap } from "lucide-react";

type Signal = {
  id: string;
  pair: string;
  signal_type: "long" | "short";
  entry_price: string;
  take_profit: string;
  stop_loss: string;
  confidence: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

const emptyForm = {
  pair: "",
  signal_type: "long" as "long" | "short",
  entry_price: "",
  take_profit: "",
  stop_loss: "",
  confidence: 80,
  is_active: true,
  display_order: 0,
};

export const AdminSignalsManagement = () => {
  const { toast } = useToast();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Signal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchSignals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trading_signals")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSignals((data as Signal[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, display_order: signals.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (s: Signal) => {
    setEditing(s);
    setForm({
      pair: s.pair,
      signal_type: s.signal_type,
      entry_price: s.entry_price,
      take_profit: s.take_profit,
      stop_loss: s.stop_loss,
      confidence: s.confidence,
      is_active: s.is_active,
      display_order: s.display_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.pair.trim() || !form.entry_price.trim() || !form.take_profit.trim() || !form.stop_loss.trim()) {
      toast({ title: "Missing fields", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      pair: form.pair.trim(),
      signal_type: form.signal_type,
      entry_price: form.entry_price.trim(),
      take_profit: form.take_profit.trim(),
      stop_loss: form.stop_loss.trim(),
      confidence: Math.max(0, Math.min(100, Number(form.confidence) || 0)),
      is_active: form.is_active,
      display_order: Number(form.display_order) || 0,
    };

    const { error } = editing
      ? await supabase.from("trading_signals").update(payload).eq("id", editing.id)
      : await supabase.from("trading_signals").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Signal updated" : "Signal added" });
    setDialogOpen(false);
    fetchSignals();
  };

  const handleToggle = async (s: Signal) => {
    const { error } = await supabase
      .from("trading_signals")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchSignals();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("trading_signals").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Signal deleted" });
      fetchSignals();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Trading Signals
            </CardTitle>
            <CardDescription>
              Manage live signals shown on the home page. Toggle to publish/unpublish.
            </CardDescription>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> New Signal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : signals.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">No signals yet. Add your first signal.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="overflow-x-auto -mx-2 px-2"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>TP</TableHead>
                  <TableHead>SL</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.display_order}</TableCell>
                    <TableCell className="font-bold">{s.pair}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={s.signal_type === "long"
                          ? "text-green-500 border-green-500/40"
                          : "text-red-500 border-red-500/40"}
                      >
                        {s.signal_type === "long" ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {s.signal_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{s.entry_price}</TableCell>
                    <TableCell className="font-mono text-green-500">{s.take_profit}</TableCell>
                    <TableCell className="font-mono text-red-500">{s.stop_loss}</TableCell>
                    <TableCell>{s.confidence}%</TableCell>
                    <TableCell>
                      <Switch checked={s.is_active} onCheckedChange={() => handleToggle(s)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteId(s.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Signal" : "New Signal"}</DialogTitle>
            <DialogDescription>
              Signals marked active will appear on the home page.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Pair *</Label>
              <Input
                placeholder="e.g. BTC/USDT, EUR/USD"
                value={form.pair}
                onChange={(e) => setForm({ ...form, pair: e.target.value })}
              />
            </div>
            <div>
              <Label>Type *</Label>
              <Select
                value={form.signal_type}
                onValueChange={(v: "long" | "short") => setForm({ ...form, signal_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">LONG</SelectItem>
                  <SelectItem value="short">SHORT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Display Order</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Entry Price *</Label>
              <Input
                placeholder="67,420"
                value={form.entry_price}
                onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
              />
            </div>
            <div>
              <Label>Take Profit *</Label>
              <Input
                placeholder="69,800"
                value={form.take_profit}
                onChange={(e) => setForm({ ...form, take_profit: e.target.value })}
              />
            </div>
            <div>
              <Label>Stop Loss *</Label>
              <Input
                placeholder="66,200"
                value={form.stop_loss}
                onChange={(e) => setForm({ ...form, stop_loss: e.target.value })}
              />
            </div>
            <div>
              <Label>Confidence % (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.confidence}
                onChange={(e) => setForm({ ...form, confidence: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Publish (Active)</Label>
                <p className="text-xs text-muted-foreground">Active signals appear on the home page</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Signal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete signal?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
