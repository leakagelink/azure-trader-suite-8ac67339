import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Shield, Save } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

interface AdminUser {
  id: string;
  email: string;
  signup_date: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  roles: string[];
  max_leverage: number | null;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leverageDraft, setLeverageDraft] = useState<Record<string, string>>({});
  const [savingLeverage, setSavingLeverage] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdminStatus();
    }
  }, [user, authLoading, navigate]);

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
      fetchUsers();
    } catch (error: any) {
      console.error("Error checking admin status:", error);
      toast.error("Failed to verify admin access");
      navigate("/dashboard");
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("admin_users_view")
        .select("*")
        .order("signup_date", { ascending: false });

      if (error) throw error;

      const baseUsers = data || [];
      const userIds = baseUsers.map((u: any) => u.id);
      let leverageMap: Record<string, number | null> = {};
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, max_leverage")
          .in("id", userIds);
        (profileRows || []).forEach((p: any) => {
          leverageMap[p.id] = p.max_leverage ?? null;
        });
      }
      const merged: AdminUser[] = baseUsers.map((u: any) => ({
        ...u,
        max_leverage: leverageMap[u.id] ?? null,
      }));
      setUsers(merged);
      const draft: Record<string, string> = {};
      merged.forEach((u) => {
        draft[u.id] = u.max_leverage != null ? String(u.max_leverage) : "";
      });
      setLeverageDraft(draft);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const saveLeverageCap = async (userId: string) => {
    const raw = (leverageDraft[userId] ?? "").trim();
    let value: number | null = null;
    if (raw !== "") {
      const n = parseInt(raw);
      if (isNaN(n) || n < 1 || n > 100) {
        toast.error("Leverage cap must be between 1 and 100");
        return;
      }
      value = n;
    }
    try {
      setSavingLeverage((s) => ({ ...s, [userId]: true }));
      const { error } = await supabase
        .from("profiles")
        .update({ max_leverage: value })
        .eq("id", userId);
      if (error) throw error;
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, max_leverage: value } : u));
      toast.success(value === null ? "Per-user cap cleared (uses global)" : `Leverage cap set to ${value}x`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save leverage cap");
    } finally {
      setSavingLeverage((s) => ({ ...s, [userId]: false }));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 animate-pulse" />
          <p>Verifying broker access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <h1 className="text-xl font-bold">Broker Dashboard</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Registered Users</CardTitle>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {users.length} Total
              </Badge>
            </div>
            <CardDescription>
              View and manage all registered users in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No users registered yet</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <div className="overflow-x-auto -mx-2 px-2"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Signup Date</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Leverage Cap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || "Not provided"}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{formatDate(user.signup_date)}</TableCell>
                        <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
                        <TableCell>
                          {user.email_confirmed_at ? (
                            <Badge variant="default">Verified</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles?.map((role) => (
                              <Badge
                                key={role}
                                variant={role === "admin" ? "destructive" : "outline"}
                              >
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              step="1"
                              placeholder="Global"
                              className="h-8 w-24"
                              value={leverageDraft[user.id] ?? ""}
                              onChange={(e) =>
                                setLeverageDraft((d) => ({ ...d, [user.id]: e.target.value }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!savingLeverage[user.id]}
                              onClick={() => saveLeverageCap(user.id)}
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {user.max_leverage != null ? `${user.max_leverage}x override` : "Using global cap"}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Broker Actions</CardTitle>
            <CardDescription>
              Additional broker tools and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => navigate("/user-approvals")} variant="default" className="w-full">
              User Approvals
            </Button>
            <Button onClick={() => navigate("/admin-panel")} variant="outline" className="w-full">
              Open Broker Panel
            </Button>
            <Button onClick={() => navigate("/deposit-requests")} variant="outline" className="w-full">
              View Deposit Requests
            </Button>
            <Button onClick={() => navigate("/admin/positions")} variant="outline" className="w-full">
              View All User Positions
            </Button>
            <Button onClick={fetchUsers} variant="outline" className="w-full">
              Refresh User List
            </Button>
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Admin;
