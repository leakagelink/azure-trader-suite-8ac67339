import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const PendingApproval = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    checkApprovalStatus();

    // Check approval status every 10 seconds
    const interval = setInterval(checkApprovalStatus, 10000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const checkApprovalStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data?.is_approved) {
        setApprovalStatus('approved');
        navigate("/dashboard");
      } else {
        setApprovalStatus('pending');
      }
    } catch (error) {
      console.error("Error checking approval status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">Checking account status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Your account has been created successfully and is currently under review by our broker team.
            </p>
            <p className="text-sm text-muted-foreground">
              You will be able to access your account once it's approved. This typically takes up to 24 hours.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Account created</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
              <span>Awaiting broker approval (within 24 hours)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
              <span>Full account access</span>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Please check back later or contact support if you have any questions.</p>
          </div>

          <Button 
            onClick={signOut} 
            variant="outline" 
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
