import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, UserCheck, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

interface PendingUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  is_approved: boolean;
}

const UserApprovals = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdminStatus();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // Update countdown every second
    const interval = setInterval(() => {
      updateTimeLeft();
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingUsers]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Access denied. Broker privileges required.");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      fetchPendingUsers();
    } catch (error: any) {
      console.error("Error checking admin status:", error);
      toast.error("Failed to verify broker access");
      navigate("/dashboard");
    }
  };

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, is_approved")
        .eq("is_approved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPendingUsers(data || []);
      updateTimeLeft(data || []);
    } catch (error: any) {
      console.error("Error fetching pending users:", error);
      toast.error("Failed to load pending users");
    } finally {
      setLoading(false);
    }
  };

  const updateTimeLeft = (users: PendingUser[] = pendingUsers) => {
    const now = new Date().getTime();
    const timeLeftMap: Record<string, string> = {};

    users.forEach(user => {
      const createdAt = new Date(user.created_at).getTime();
      const expiresAt = createdAt + (24 * 60 * 60 * 1000); // 24 hours
      const remaining = expiresAt - now;

      if (remaining <= 0) {
        timeLeftMap[user.id] = "Expired";
      } else {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        timeLeftMap[user.id] = `${hours}h ${minutes}m ${seconds}s`;
      }
    });

    setTimeLeft(timeLeftMap);
  };

  const handleApprove = async (userId: string) => {
    try {
      // Find the user to get email info
      const user = pendingUsers.find(u => u.id === userId);
      
      const { error } = await supabase.rpc('approve_user', {
        target_user_id: userId
      });

      if (error) throw error;

      // Send email notification
      if (user?.email) {
        try {
          await supabase.functions.invoke("send-account-notification", {
            body: {
              email: user.email,
              userName: user.full_name || "Trader",
              status: "activated",
            },
          });
        } catch (emailError) {
          console.error("Failed to send account activation email:", emailError);
        }
      }

      toast.success("User approved successfully!");
      fetchPendingUsers();
    } catch (error: any) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin" />
          <p>Verifying broker access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            <h1 className="text-xl font-bold">User Approvals</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchPendingUsers}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <CardTitle>Pending User Approvals</CardTitle>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {pendingUsers.length} Pending
              </Badge>
            </div>
            <CardDescription>
              Review and approve user registrations within 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading pending users...</p>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-muted-foreground">No pending approvals</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Time Remaining</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((pendingUser) => (
                      <TableRow key={pendingUser.id}>
                        <TableCell className="font-medium">
                          {pendingUser.full_name || "Not provided"}
                        </TableCell>
                        <TableCell>{pendingUser.email}</TableCell>
                        <TableCell>{formatDate(pendingUser.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
                            <span className={`font-mono font-semibold ${
                              timeLeft[pendingUser.id] === "Expired" 
                                ? "text-red-500" 
                                : "text-yellow-500"
                            }`}>
                              {timeLeft[pendingUser.id] || "24h 0m 0s"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => handleApprove(pendingUser.id)}
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default UserApprovals;
