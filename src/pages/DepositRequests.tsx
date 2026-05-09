import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, RefreshCw, Lock, Clock, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DepositRequests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(0.012);
  const [activeTab, setActiveTab] = useState<string>("all");

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      const hasAdminRole = roles?.some((r) => r.role === "admin");
      if (!hasAdminRole) {
        toast({
          title: "Access Denied",
          description: "You need broker privileges to access this page",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Fetch exchange rate from payment settings
      const { data: settingsData } = await supabase
        .from("payment_settings")
        .select("setting_value")
        .eq("setting_key", "exchange_rate")
        .single();
      
      if (settingsData?.setting_value) {
        setExchangeRate(parseFloat(settingsData.setting_value));
      }

      const { data, error } = await supabase
        .from("deposit_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch user profiles separately
      const userIds = data?.map(d => d.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      // Merge profiles with requests
      const requestsWithProfiles = data?.map(request => ({
        ...request,
        profiles: profiles?.find(p => p.id === request.user_id)
      })) || [];
      
      setRequests(requestsWithProfiles);
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

  const handleApprove = async (depositId: string) => {
    try {
      const deposit = requests.find(r => r.id === depositId);
      
      const { error } = await supabase.rpc("approve_deposit", {
        deposit_id: depositId,
      });

      if (error) throw error;

      // Send email notification
      if (deposit?.profiles?.email) {
        try {
          await supabase.functions.invoke("send-deposit-notification", {
            body: {
              email: deposit.profiles.email,
              userName: deposit.profiles.full_name || "Trader",
              status: "approved",
              amount: deposit.amount,
              currency: deposit.currency,
            },
          });
        } catch (emailError) {
          console.error("Failed to send deposit notification email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: "Deposit approved and wallet updated",
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (depositId: string) => {
    try {
      const deposit = requests.find(r => r.id === depositId);
      
      // Use the reject_deposit function which also handles locked_balance
      const { error } = await supabase.rpc("reject_deposit", {
        deposit_id: depositId,
      });

      if (error) throw error;

      // Send email notification
      if (deposit?.profiles?.email) {
        try {
          await supabase.functions.invoke("send-deposit-notification", {
            body: {
              email: deposit.profiles.email,
              userName: deposit.profiles.full_name || "Trader",
              status: "rejected",
              amount: deposit.amount,
              currency: deposit.currency,
              rejectionReason: "Rejected by broker",
            },
          });
        } catch (emailError) {
          console.error("Failed to send deposit notification email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: deposit?.status === "locked" 
          ? "Deposit rejected and locked balance removed" 
          : "Deposit request rejected",
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchRequests();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Verifying broker access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="CoinGoldFX Broker" className="h-10 w-auto object-contain" />
          </div>
           <Button variant="ghost" onClick={() => navigate("/admin")}>
             Back to Broker
           </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Deposit Requests</h1>
            <p className="text-muted-foreground">Review and approve user deposit requests</p>
          </div>
          <Button onClick={fetchRequests} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-5 max-w-xl">
            <TabsTrigger value="all" className="flex items-center gap-1">
              All
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {requests.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Pending
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {requests.filter(r => r.status === "pending").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="locked" className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Locked
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {requests.filter(r => r.status === "locked").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Approved
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {requests.filter(r => r.status === "approved").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Rejected
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {requests.filter(r => r.status === "rejected").length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading requests...</p>
          ) : requests.filter(r => activeTab === "all" || r.status === activeTab).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No {activeTab === "all" ? "" : activeTab} deposit requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests
                  .filter(r => activeTab === "all" || r.status === activeTab)
                  .map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.profiles?.full_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{request.profiles?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      <div>
                        <div>{request.currency === "INR" ? "₹" : "$"}{parseFloat(request.amount).toFixed(2)}</div>
                        {request.currency === "INR" && (
                          <div className="text-xs text-muted-foreground">
                            ≈ ${(parseFloat(request.amount) * exchangeRate).toFixed(2)} USD
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {request.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{request.transaction_id}</code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "default"
                            : request.status === "rejected"
                            ? "destructive"
                            : request.status === "locked"
                            ? "outline"
                            : "secondary"
                        }
                        className={`capitalize ${request.status === "locked" ? "border-amber-500 text-amber-500" : ""}`}
                      >
                        {request.status === "locked" && <Lock className="h-3 w-3 mr-1" />}
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {(request.status === "pending" || request.status === "locked") && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {request.status === "locked" ? "Verify & Approve" : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(request.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </div>
  );
};

export default DepositRequests;
