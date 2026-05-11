import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Clock, ShieldCheck, Upload, XCircle, Loader2, FileText, User as UserIcon, MapPin, Briefcase, FileCheck2,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import logo from "@/assets/logo.png";

type KycStatus = "pending" | "approved" | "rejected";

interface ExistingKyc {
  status: KycStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  first_name: string;
  last_name: string;
}

const STEPS = [
  { id: 1, title: "Personal Info", icon: UserIcon },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Occupation", icon: Briefcase },
  { id: 4, title: "Document", icon: FileCheck2 },
];

const personalSchema = z.object({
  first_name: z.string().trim().min(1, "First name required").max(60),
  last_name: z.string().trim().min(1, "Last name required").max(60),
  date_of_birth: z.string().min(1, "Date of birth required"),
});

const addressSchema = z.object({
  country: z.string().trim().min(1, "Country required").max(60),
  address: z.string().trim().min(3, "Address required").max(200),
  city: z.string().trim().min(1, "City required").max(60),
  postal_code: z.string().trim().min(2, "Postal code required").max(20),
});

const occupationSchema = z.object({
  occupation_type: z.string().min(1, "Select occupation type"),
  business_type: z.string().max(100).optional(),
  job_title: z.string().max(100).optional(),
  annual_income: z.string().trim().min(1, "Enter annual income").max(100),
  trading_experience: z.string().min(1, "Select trading experience"),
});

const KYC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [existing, setExisting] = useState<ExistingKyc | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    country: "India",
    address: "",
    city: "",
    postal_code: "",
    id_document_type: "aadhaar",
    occupation_type: "",
    business_type: "",
    job_title: "",
    annual_income: "",
    trading_experience: "",
  });
  const [docFile, setDocFile] = useState<File | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const { data } = await supabase
        .from("kyc_submissions")
        .select("status, rejection_reason, reviewed_at, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) setExisting(data as ExistingKyc);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleNext = () => {
    try {
      if (step === 1) {
        personalSchema.parse({
          first_name: form.first_name,
          last_name: form.last_name,
          date_of_birth: form.date_of_birth,
        });
      } else if (step === 2) {
        addressSchema.parse({
          country: form.country,
          address: form.address,
          city: form.city,
          postal_code: form.postal_code,
        });
      } else if (step === 3) {
        occupationSchema.parse({
          occupation_type: form.occupation_type,
          business_type: form.business_type,
          job_title: form.job_title,
          annual_income: form.annual_income,
          trading_experience: form.trading_experience,
        });
      }
      setStep((s) => Math.min(4, s + 1));
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message || "Please complete all required fields";
      toast({ title: "Missing info", description: msg, variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    if (!docFile) {
      toast({ title: "Document required", description: "Please upload your ID document", variant: "destructive" });
      return;
    }
    if (docFile.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB allowed", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const ext = docFile.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}_id.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("kyc-documents")
        .upload(path, docFile, { upsert: true, contentType: docFile.type });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("kyc_submissions").insert({
        user_id: userId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth,
        country: form.country.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        postal_code: form.postal_code.trim(),
        id_document_type: form.id_document_type,
        document_url: path,
        occupation_type: form.occupation_type || null,
        business_type: form.business_type || null,
        job_title: form.job_title || null,
        annual_income: form.annual_income || null,
        trading_experience: form.trading_experience || null,
        status: "pending",
      });
      if (insertErr) throw insertErr;

      toast({ title: "KYC submitted!", description: "Your KYC has been sent to the broker for review." });
      setExisting({
        status: "pending",
        rejection_reason: null,
        reviewed_at: null,
        first_name: form.first_name,
        last_name: form.last_name,
      });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    // Allow user to overwrite a rejected submission by deleting current row first via update
    if (!userId) return;
    setExisting(null);
    setStep(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-24 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <header className="border-b border-border/40 backdrop-blur-xl bg-background/70 sticky top-0 z-40">
        <div className="container max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="hover:bg-primary/10">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="TradixoFX" className="h-8 w-auto object-contain" />
            <span className="text-sm font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              KYC Verification
            </span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 lg:py-10">
        {/* Existing status view */}
        {existing && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {existing.status === "approved" && <CheckCircle2 className="h-8 w-8 text-green-500" />}
                  {existing.status === "pending" && <Clock className="h-8 w-8 text-yellow-500" />}
                  {existing.status === "rejected" && <XCircle className="h-8 w-8 text-destructive" />}
                  <div>
                    <CardTitle className="capitalize">KYC {existing.status}</CardTitle>
                    <CardDescription>
                      {existing.first_name} {existing.last_name}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant={existing.status === "approved" ? "default" : existing.status === "rejected" ? "destructive" : "secondary"}
                  className="capitalize"
                >
                  {existing.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {existing.status === "pending" && (
                <p className="text-sm text-muted-foreground">
                  Your KYC has been submitted. The broker will review it and notify you by email. This process can take 24–48 hours.
                </p>
              )}
              {existing.status === "approved" && (
                <p className="text-sm text-muted-foreground">
                  Congratulations! Your KYC is verified. You can now use all features.
                </p>
              )}
              {existing.status === "rejected" && (
                <>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <p className="text-xs font-semibold text-destructive mb-1">Rejection reason:</p>
                    <p className="text-sm">{existing.rejection_reason || "Documents could not be verified"}</p>
                  </div>
                  <Button onClick={handleResubmit} className="w-full">Resubmit KYC</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {!existing && (
          <Card className="border-primary/20 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Step {step} of 4 — {STEPS[step - 1].title}
                </CardTitle>
                <Badge variant="outline">{Math.round((step / 4) * 100)}%</Badge>
              </div>
              <Progress value={(step / 4) * 100} className="h-2" />
              <div className="flex justify-between mt-3">
                {STEPS.map((s) => {
                  const Icon = s.icon;
                  const active = step === s.id;
                  const done = step > s.id;
                  return (
                    <div key={s.id} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                          done
                            ? "bg-primary text-primary-foreground"
                            : active
                            ? "bg-gradient-to-br from-primary to-accent text-primary-foreground ring-2 ring-primary/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className={`text-[10px] hidden sm:block ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {s.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name *</Label>
                      <Input
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                        placeholder="As per ID"
                        maxLength={60}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name *</Label>
                      <Input
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                        placeholder="As per ID"
                        maxLength={60}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth *</Label>
                    <Input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                      max={new Date(Date.now() - 18 * 365 * 24 * 3600 * 1000).toISOString().split("T")[0]}
                    />
                    <p className="text-xs text-muted-foreground">You must be 18+ to verify</p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label>Country *</Label>
                    <Input
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Address *</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="House no., street, area"
                      maxLength={200}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>City *</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        maxLength={60}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal Code *</Label>
                      <Input
                        value={form.postal_code}
                        onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                        maxLength={20}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label>Occupation Type *</Label>
                    <Select
                      value={form.occupation_type}
                      onValueChange={(v) => setForm({ ...form, occupation_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select occupation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salaried">Salaried (Job)</SelectItem>
                        <SelectItem value="self_employed">Self-Employed / Business</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                        <SelectItem value="homemaker">Homemaker</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.occupation_type === "salaried" && (
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input
                        value={form.job_title}
                        onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                        placeholder="e.g. Software Engineer"
                        maxLength={100}
                      />
                    </div>
                  )}

                  {form.occupation_type === "self_employed" && (
                    <div className="space-y-2">
                      <Label>Business Type</Label>
                      <Input
                        value={form.business_type}
                        onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                        placeholder="e.g. Retail, Trading, Consulting"
                        maxLength={100}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Annual Income *</Label>
                    <Input
                      value={form.annual_income}
                      onChange={(e) => setForm({ ...form, annual_income: e.target.value })}
                      placeholder="e.g. ₹5,00,000 per year"
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Trading Experience *</Label>
                    <Select
                      value={form.trading_experience}
                      onValueChange={(v) => setForm({ ...form, trading_experience: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your experience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No experience</SelectItem>
                        <SelectItem value="beginner">Beginner (less than 1 year)</SelectItem>
                        <SelectItem value="intermediate">Intermediate (1 – 3 years)</SelectItem>
                        <SelectItem value="experienced">Experienced (3 – 5 years)</SelectItem>
                        <SelectItem value="expert">Expert (5+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label>ID Document Type *</Label>
                    <Select
                      value={form.id_document_type}
                      onValueChange={(v) => setForm({ ...form, id_document_type: v })}
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

                  <div className="space-y-2">
                    <Label>Upload Document *</Label>
                    <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      {docFile ? (
                        <div className="flex flex-col items-center gap-1">
                          <FileText className="h-10 w-10 text-primary" />
                          <span className="text-sm font-medium break-all">{docFile.name}</span>
                          <span className="text-xs text-muted-foreground">{(docFile.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-10 w-10 text-muted-foreground" />
                          <span className="text-sm font-medium">Click to upload</span>
                          <span className="text-xs text-muted-foreground">JPG, PNG or PDF • Max 10MB</span>
                        </div>
                      )}
                    </label>
                  </div>

                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground mb-1">📋 Review your information</p>
                    <p>Name: {form.first_name} {form.last_name}</p>
                    <p>DOB: {form.date_of_birth}</p>
                    <p>Address: {form.address}, {form.city}, {form.postal_code}, {form.country}</p>
                    <p>Occupation: {form.occupation_type}</p>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/40">
                <Button
                  variant="outline"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  disabled={step === 1 || submitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>

                {step < 4 ? (
                  <Button onClick={handleNext} className="bg-gradient-to-r from-primary to-accent">
                    Next <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !docFile}
                    className="bg-gradient-to-r from-primary to-accent"
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Submit KYC</>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default KYC;
