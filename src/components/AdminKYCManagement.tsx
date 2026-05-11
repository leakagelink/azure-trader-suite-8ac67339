import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck, Search, Loader2, Eye, Check, X, FileText, RefreshCw, Clock, CheckCircle2, XCircle, Pencil, Save,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type KycStatus = "pending" | "approved" | "rejected";

interface KycRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  country: string;
  address: string;
  city: string;
  postal_code: string;
  id_document_type: string;
  document_url: string | null;
  status: KycStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  occupation_type: string | null;
  business_type: string | null;
  job_title: string | null;
  annual_income: string | null;
  trading_experience: string | null;
}

interface UserInfo {
  email: string | null;
  full_name: string | null;
  client_id: string | null;
}

export const AdminKYCManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<KycRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserInfo>>({});
  const [filter, setFilter] = useState<"all" | KycStatus>("pending");
  const [search, setSearch] = useState("");

  const [viewing, setViewing] = useState<KycRow | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning, setActioning] = useState(false);

  // Edit state
  const [editing, setEditing] = useState<KycRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<KycRow>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: kycData, error: kycErr } = await supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (kycErr) throw kycErr;
      setRows((kycData as KycRow[]) || []);

      const userIds = [...new Set((kycData || []).map((k: any) => k.user_id))];
      if (userIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("id, email, full_name, client_id")
          .in("id", userIds);
        const map: Record<string, UserInfo> = {};
        (profData || []).forEach((p: any) => {
          map[p.id] = { email: p.email, full_name: p.full_name, client_id: p.client_id };
        });
        setProfiles(map);
      }
    } catch (err: any) {
      toast({ title: "Error loading KYC", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("admin-kyc-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openView = async (row: KycRow) => {
    setViewing(row);
    setDocUrl(null);
    if (row.document_url) {
      setLoadingDoc(true);
      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(row.document_url, 600);
      if (!error && data) setDocUrl(data.signedUrl);
      setLoadingDoc(false);
    }
  };

  const sendEmail = async (row: KycRow, status: "approved" | "rejected", reason?: string) => {
    const profile = profiles[row.user_id];
    if (!profile?.email) return;
    try {
      await supabase.functions.invoke("send-kyc-notification", {
        body: {
          email: profile.email,
          userName: profile.full_name || `${row.first_name} ${row.last_name}`,
          status,
          rejectionReason: reason,
        },
      });
    } catch (err) {
      console.error("KYC email failed:", err);
    }
  };

  const handleApprove = async (row: KycRow) => {
    setActioning(true);
    try {
      const { error } = await supabase.rpc("approve_kyc", { kyc_id: row.id });
      if (error) throw error;
      await sendEmail(row, "approved");
      toast({ title: "KYC approved", description: `${row.first_name} ${row.last_name} verified successfully.` });
      setViewing(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async () => {
    if (!viewing) return;
    if (!rejectReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    setActioning(true);
    try {
      const { error } = await supabase.rpc("reject_kyc", {
        kyc_id: viewing.id,
        reason: rejectReason.trim(),
      });
      if (error) throw error;
      await sendEmail(viewing, "rejected", rejectReason.trim());
      toast({ title: "KYC rejected", description: "User has been notified by email." });
      setRejectOpen(false);
      setRejectReason("");
      setViewing(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Reject failed", description: err.message, variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const openEdit = (row: KycRow) => {
    setViewing(null);
    setEditing(row);
    setEditForm({
      first_name: row.first_name,
      last_name: row.last_name,
      date_of_birth: row.date_of_birth,
      country: row.country,
      address: row.address,
      city: row.city,
      postal_code: row.postal_code,
      id_document_type: row.id_document_type,
      occupation_type: row.occupation_type,
      business_type: row.business_type,
      job_title: row.job_title,
      annual_income: row.annual_income,
      trading_experience: row.trading_experience,
      status: row.status,
      rejection_reason: row.rejection_reason,
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editForm.first_name?.trim() || !editForm.last_name?.trim()) {
      toast({ title: "Required fields missing", description: "First and last name are required", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("kyc_submissions")
        .update({
          first_name: editForm.first_name?.trim(),
          last_name: editForm.last_name?.trim(),
          date_of_birth: editForm.date_of_birth,
          country: editForm.country?.trim(),
          address: editForm.address?.trim(),
          city: editForm.city?.trim(),
          postal_code: editForm.postal_code?.trim(),
          id_document_type: editForm.id_document_type,
          occupation_type: editForm.occupation_type || null,
          business_type: editForm.business_type || null,
          job_title: editForm.job_title || null,
          annual_income: editForm.annual_income || null,
          trading_experience: editForm.trading_experience || null,
          status: editForm.status,
          rejection_reason: editForm.status === "rejected" ? (editForm.rejection_reason || null) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (error) throw error;

      toast({ title: "KYC updated", description: "Details saved successfully." });
      setEditing(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const profile = profiles[r.user_id];
      return (
        r.first_name.toLowerCase().includes(q) ||
        r.last_name.toLowerCase().includes(q) ||
        profile?.email?.toLowerCase().includes(q) ||
        profile?.client_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  const statusBadge = (status: KycStatus) => {
    const map = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Pending" },
      approved: { variant: "default" as const, icon: CheckCircle2, label: "Approved" },
      rejected: { variant: "destructive" as const, icon: XCircle, label: "Rejected" },
    };
    const { variant, icon: Icon, label } = map[status];
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" /> {label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              KYC Management
            </CardTitle>
            <CardDescription>Review and approve user KYC submissions</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{counts.pending} pending</Badge>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, client ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No KYC submissions found</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <div className="overflow-x-auto -mx-2 px-2"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Client ID</TableHead>
                  <TableHead className="hidden lg:table-cell">Document</TableHead>
                  <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const profile = profiles[row.user_id];
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.first_name} {row.last_name}</span>
                          <span className="text-xs text-muted-foreground">{profile?.email || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs">
                        {profile?.client_id || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell capitalize text-sm">
                        {row.id_document_type.replace("_", " ")}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openView(row)}>
                            <Eye className="h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          {row.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleApprove(row)}
                              disabled={actioning}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></div>
          </div>
        )}
      </CardContent>

      {/* View / Review Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              KYC Review — {viewing?.first_name} {viewing?.last_name}
            </DialogTitle>
            <DialogDescription>
              Submitted {viewing && new Date(viewing.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Email:</span> <br />{profiles[viewing.user_id]?.email || "—"}</div>
                <div><span className="text-muted-foreground">Client ID:</span> <br /><span className="font-mono">{profiles[viewing.user_id]?.client_id || "—"}</span></div>
                <div><span className="text-muted-foreground">DOB:</span> <br />{viewing.date_of_birth}</div>
                <div><span className="text-muted-foreground">Document Type:</span> <br /><span className="capitalize">{viewing.id_document_type.replace("_", " ")}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <br />{viewing.address}, {viewing.city}, {viewing.postal_code}, {viewing.country}</div>
                {viewing.occupation_type && (
                  <div><span className="text-muted-foreground">Occupation:</span> <br /><span className="capitalize">{viewing.occupation_type.replace("_", " ")}</span></div>
                )}
                {viewing.annual_income && (
                  <div><span className="text-muted-foreground">Annual Income:</span> <br />{viewing.annual_income}</div>
                )}
                {viewing.trading_experience && (
                  <div><span className="text-muted-foreground">Trading Experience:</span> <br /><span className="capitalize">{viewing.trading_experience.replace("_", " ")}</span></div>
                )}
                {viewing.job_title && (
                  <div><span className="text-muted-foreground">Job Title:</span> <br />{viewing.job_title}</div>
                )}
                {viewing.business_type && (
                  <div><span className="text-muted-foreground">Business Type:</span> <br />{viewing.business_type}</div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">ID Document</p>
                {loadingDoc ? (
                  <div className="flex items-center justify-center py-8 border rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : docUrl ? (
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    {docUrl.toLowerCase().includes(".pdf") || viewing.document_url?.toLowerCase().endsWith(".pdf") ? (
                      <iframe src={docUrl} className="w-full h-96" title="KYC Document" />
                    ) : (
                      <img src={docUrl} alt="KYC Document" className="w-full max-h-96 object-contain" />
                    )}
                    <div className="p-2 border-t bg-background">
                      <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Open in new tab ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center border rounded-lg">No document uploaded</p>
                )}
              </div>

              {viewing.status === "rejected" && viewing.rejection_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Rejection reason:</p>
                  <p className="text-sm">{viewing.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            <Button variant="outline" onClick={() => viewing && openEdit(viewing)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            {viewing?.status === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setRejectOpen(true)}
                  disabled={actioning}
                >
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button
                  onClick={() => viewing && handleApprove(viewing)}
                  disabled={actioning}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actioning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject KYC submission</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason. The user will be notified by email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="e.g. Document image not clear, please re-upload"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={500}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actioning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={actioning || !rejectReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actioning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Reject KYC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit KYC dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit KYC — {editing?.first_name} {editing?.last_name}
            </DialogTitle>
            <DialogDescription>
              Update any field. Changes are saved instantly. User won't be notified by email.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              {/* Personal */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Personal</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">First Name *</Label>
                    <Input
                      value={editForm.first_name || ""}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Last Name *</Label>
                    <Input
                      value={editForm.last_name || ""}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input
                    type="date"
                    value={editForm.date_of_birth || ""}
                    onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Address</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={editForm.address || ""}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    maxLength={200}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">City</Label>
                    <Input
                      value={editForm.city || ""}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Postal Code</Label>
                    <Input
                      value={editForm.postal_code || ""}
                      onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Country</Label>
                    <Input
                      value={editForm.country || ""}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                </div>
              </div>

              {/* Document */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Document</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">ID Document Type</Label>
                  <Select
                    value={editForm.id_document_type || ""}
                    onValueChange={(v) => setEditForm({ ...editForm, id_document_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                      <SelectItem value="pan">PAN Card</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="driving_license">Driving License</SelectItem>
                      <SelectItem value="voter_id">Voter ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Occupation */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Occupation</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Occupation Type</Label>
                    <Select
                      value={editForm.occupation_type || ""}
                      onValueChange={(v) => setEditForm({ ...editForm, occupation_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salaried">Salaried</SelectItem>
                        <SelectItem value="self_employed">Self-Employed</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                        <SelectItem value="homemaker">Homemaker</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Annual Income</Label>
                    <Input
                      value={editForm.annual_income || ""}
                      onChange={(e) => setEditForm({ ...editForm, annual_income: e.target.value })}
                      placeholder="e.g. ₹5,00,000 per year"
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Job Title</Label>
                    <Input
                      value={editForm.job_title || ""}
                      onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Business Type</Label>
                    <Input
                      value={editForm.business_type || ""}
                      onChange={(e) => setEditForm({ ...editForm, business_type: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Trading Experience</Label>
                    <Select
                      value={editForm.trading_experience || ""}
                      onValueChange={(v) => setEditForm({ ...editForm, trading_experience: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No experience</SelectItem>
                        <SelectItem value="beginner">Beginner (&lt;1 year)</SelectItem>
                        <SelectItem value="intermediate">Intermediate (1–3 years)</SelectItem>
                        <SelectItem value="experienced">Experienced (3–5 years)</SelectItem>
                        <SelectItem value="expert">Expert (5+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Status</p>
                <Select
                  value={editForm.status || "pending"}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as KycStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                {editForm.status === "rejected" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rejection Reason</Label>
                    <Textarea
                      value={editForm.rejection_reason || ""}
                      onChange={(e) => setEditForm({ ...editForm, rejection_reason: e.target.value })}
                      maxLength={500}
                      placeholder="Reason shown to user"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="bg-gradient-to-r from-primary to-accent">
              {savingEdit ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
