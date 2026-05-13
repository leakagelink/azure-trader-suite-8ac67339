import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, Shield, Users, Wallet, Settings, SettingsIcon, 
  Check, X, RefreshCw, Edit, Trash2, DollarSign, FileText, ArrowUpRight, Upload, Loader2, Lock, Phone, Search, ChevronLeft, ChevronRight, Gift, Smartphone, Download, Globe, Gem
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { AdminTradeManagement } from "@/components/AdminTradeManagement";
import { AdminAPIManagement } from "@/components/AdminAPIManagement";
import { AdminKYCManagement } from "@/components/AdminKYCManagement";
import { AdminSignalsManagement } from "@/components/AdminSignalsManagement";
import { AdminAuditLog } from "@/components/AdminAuditLog";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("approvals");

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  
  // Add fund state
  const [addFundOpen, setAddFundOpen] = useState(false);
  const [addFundUser, setAddFundUser] = useState<any>(null);
  const [addFundAmount, setAddFundAmount] = useState("");
  const [addingFund, setAddingFund] = useState(false);
  
  // User search and pagination
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const USERS_PER_PAGE = 20;
  
  // Password change state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [newLoginPassword, setNewLoginPassword] = useState("");
  const [confirmLoginPassword, setConfirmLoginPassword] = useState("");
  const [changingLoginPassword, setChangingLoginPassword] = useState(false);

  // Deposits state
  const [depositRequests, setDepositRequests] = useState<any[]>([]);

  // Withdrawals state
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);

  // KYC state (count only — list managed inside AdminKYCManagement)
  const [pendingKycCount, setPendingKycCount] = useState(0);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [approveWithdrawalOpen, setApproveWithdrawalOpen] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  const [rejectWithdrawalOpen, setRejectWithdrawalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState({
    upiId: "tradixofx@upi",
    qrCodeUrl: "",
    accountName: "TradixoFX Account",
    accountNumber: "1234567890",
    ifsc: "BANK0001234",
    bankName: "Demo Bank",
    exchangeRate: "0.012",
    appDownloadUrl: "",
    apiPassword: "",
    maxLeverage: "100",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [uploadingApp, setUploadingApp] = useState(false);
  
  // Deposit offer settings state
  const [depositOfferSettings, setDepositOfferSettings] = useState({
    bonusEnabled: true,
    bonusPercentage: "30",
    minAmount: "200",
    maxAmount: "2000",
    bonusMax: "600",
    offerTitle: "Christmas Bonus",
  });
  
  // Market settings state
  const [marketSettings, setMarketSettings] = useState({
    forexEnabled: true,
    commoditiesEnabled: true,
    forexMomentumEnabled: true,
    commoditiesMomentumEnabled: true,
  });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin, activeTab]);
  
  // Update countdown timer every second for approvals tab
  useEffect(() => {
    if (activeTab === 'approvals' && pendingUsers.length > 0) {
      const interval = setInterval(() => {
        // Force re-render to update time remaining
        setPendingUsers(prev => [...prev]);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [activeTab, pendingUsers.length]);

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

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);
      
      // Separate pending users
      const pending = usersData?.filter(u => !u.is_approved) || [];
      setPendingUsers(pending);

      // Fetch wallets
      const { data: walletsData, error: walletsError } = await supabase
        .from("user_wallets")
        .select("*");

      if (walletsError) throw walletsError;
      setWallets(walletsData || []);

      // Fetch deposit requests
      const { data: depositsData, error: depositsError } = await supabase
        .from("deposit_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (depositsError) throw depositsError;
      
      // Fetch user profiles for deposits
      const depositUserIds = depositsData?.map(d => d.user_id) || [];
      const { data: depositProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", depositUserIds);
      
      // Merge profiles with deposits
      const depositsWithProfiles = depositsData?.map(deposit => ({
        ...deposit,
        profiles: depositProfiles?.find(p => p.id === deposit.user_id)
      })) || [];
      
      setDepositRequests(depositsWithProfiles);

      // Fetch withdrawal requests
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (withdrawalsError) throw withdrawalsError;
      
      // Fetch user profiles for withdrawals
      const withdrawalUserIds = withdrawalsData?.map(w => w.user_id) || [];
      const { data: withdrawalProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", withdrawalUserIds);
      
      // Merge profiles with withdrawals
      const withdrawalsWithProfiles = withdrawalsData?.map(withdrawal => ({
        ...withdrawal,
        profiles: withdrawalProfiles?.find(p => p.id === withdrawal.user_id)
      })) || [];
      
      setWithdrawalRequests(withdrawalsWithProfiles);

      // Fetch pending KYC count
      const { count: kycCount } = await supabase
        .from("kyc_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingKycCount(kycCount || 0);

      // Fetch payment settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("payment_settings")
        .select("*");

      if (settingsError) throw settingsError;

      // Convert settings array to object
      if (settingsData) {
        const settings: any = {};
        settingsData.forEach((setting) => {
          const key = setting.setting_key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          settings[key] = setting.setting_value;
        });
        setPaymentSettings({
          upiId: settings.upiId || "tradixofx@upi",
          qrCodeUrl: settings.qrCodeUrl || "",
          accountName: settings.accountName || "TradixoFX Account",
          accountNumber: settings.accountNumber || "1234567890",
          ifsc: settings.ifscCode || "BANK0001234",
          bankName: settings.bankName || "Demo Bank",
          exchangeRate: settings.exchangeRate || "0.012",
          appDownloadUrl: settings.appDownloadUrl || "",
          apiPassword: "",
          maxLeverage: settings.maxLeverage || "100",
        });
        
        // Set deposit offer settings
        setDepositOfferSettings({
          bonusEnabled: settings.depositBonusEnabled === 'true',
          bonusPercentage: settings.depositBonusPercentage || "30",
          minAmount: settings.depositMinAmount || "200",
          maxAmount: settings.depositMaxAmount || "2000",
          bonusMax: settings.depositBonusMax || "600",
          offerTitle: settings.depositOfferTitle || "Christmas Bonus",
        });
        
        // Set market settings
        setMarketSettings({
          forexEnabled: settings.forexEnabled !== 'false',
          commoditiesEnabled: settings.commoditiesEnabled !== 'false',
          forexMomentumEnabled: settings.forexMomentumEnabled !== 'false',
          commoditiesMomentumEnabled: settings.commoditiesMomentumEnabled !== 'false',
        });
      }
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

  const getUserBalance = (userId: string) => {
    const userWallet = wallets.find((w) => w.user_id === userId && w.currency === "USD");
    return userWallet ? Number(userWallet.balance).toFixed(2) : "0.00";
  };

  const handleEditBalance = (user: any) => {
    setSelectedUser(user);
    setBalanceAmount(getUserBalance(user.id));
    setEditBalanceOpen(true);
  };

  const handleSaveBalance = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("user_wallets")
        .upsert({
          user_id: selectedUser.id,
          currency: "USD",
          balance: parseFloat(balanceAmount),
        }, {
          onConflict: "user_id,currency",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Balance updated successfully",
      });

      setEditBalanceOpen(false);
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddFund = async () => {
    if (!addFundUser || !addFundAmount) return;

    setAddingFund(true);
    try {
      const amountToAdd = parseFloat(addFundAmount);
      const currentBalance = parseFloat(getUserBalance(addFundUser.id));
      const newBalance = currentBalance + amountToAdd;

      const { error } = await supabase
        .from("user_wallets")
        .upsert({
          user_id: addFundUser.id,
          currency: "USD",
          balance: newBalance,
        }, {
          onConflict: "user_id,currency",
        });

      if (error) throw error;

      // Create transaction record
      await supabase.from("wallet_transactions").insert({
        user_id: addFundUser.id,
        type: "deposit",
        amount: amountToAdd,
        currency: "USD",
        status: "Completed",
      });

      toast({
        title: "Success",
        description: `$${amountToAdd.toFixed(2)} added to ${addFundUser.full_name || addFundUser.email}'s wallet`,
      });

      setAddFundOpen(false);
      setAddFundUser(null);
      setAddFundAmount("");
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingFund(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Call edge function to delete user
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: userToDelete.id },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      setDeleteUserOpen(false);
      setUserToDelete(null);
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveDeposit = async (depositId: string) => {
    try {
      // Find the deposit to get user info
      const deposit = depositRequests.find(d => d.id === depositId);
      
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

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    try {
      // Find the deposit to get user info
      const deposit = depositRequests.find(d => d.id === depositId);
      
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

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveWithdrawal = async () => {
    if (!selectedWithdrawal) return;

    try {
      const { error } = await supabase.rpc("approve_withdrawal", {
        withdrawal_id: selectedWithdrawal.id,
        transaction_ref: transactionRef || null,
      });

      if (error) throw error;

      // Send email notification
      if (selectedWithdrawal.profiles?.email) {
        try {
          await supabase.functions.invoke("send-withdrawal-notification", {
            body: {
              email: selectedWithdrawal.profiles.email,
              userName: selectedWithdrawal.profiles.full_name || "Trader",
              status: "approved",
              amount: selectedWithdrawal.amount,
              currency: selectedWithdrawal.currency,
              transactionRef: transactionRef || null,
            },
          });
        } catch (emailError) {
          console.error("Failed to send withdrawal notification email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: "Withdrawal approved and wallet updated",
      });

      setApproveWithdrawalOpen(false);
      setSelectedWithdrawal(null);
      setTransactionRef("");
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectWithdrawal = async () => {
    if (!selectedWithdrawal) return;

    try {
      const { error } = await supabase.rpc("reject_withdrawal", {
        withdrawal_id: selectedWithdrawal.id,
        reason: rejectionReason || null,
      });

      if (error) throw error;

      // Send email notification
      if (selectedWithdrawal.profiles?.email) {
        try {
          await supabase.functions.invoke("send-withdrawal-notification", {
            body: {
              email: selectedWithdrawal.profiles.email,
              userName: selectedWithdrawal.profiles.full_name || "Trader",
              status: "rejected",
              amount: selectedWithdrawal.amount,
              currency: selectedWithdrawal.currency,
              rejectionReason: rejectionReason || null,
            },
          });
        } catch (emailError) {
          console.error("Failed to send withdrawal notification email:", emailError);
        }
      }

      toast({
        title: "Success",
        description: "Withdrawal request rejected",
      });

      setRejectWithdrawalOpen(false);
      setSelectedWithdrawal(null);
      setRejectionReason("");
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      // Find the user to get email info
      const user = pendingUsers.find(u => u.id === userId) || users.find(u => u.id === userId);
      
      const { error } = await supabase.rpc("approve_user", {
        target_user_id: userId,
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

      toast({
        title: "Success",
        description: "User account activated successfully",
      });

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: false })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User account deactivated successfully",
      });

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    if (!passwordUser || !newPassword) return;
    
    setChangingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: {
          userId: passwordUser.id,
          newPassword: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: `Password updated for ${passwordUser.full_name || passwordUser.email}`,
      });

      setChangePasswordOpen(false);
      setPasswordUser(null);
      setNewPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangeLoginPassword = async () => {
    if (!newLoginPassword || newLoginPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newLoginPassword !== confirmLoginPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setChangingLoginPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newLoginPassword });
      if (error) throw error;
      toast({ title: "Success", description: "Login password changed successfully" });
      setNewLoginPassword("");
      setConfirmLoginPassword("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setChangingLoginPassword(false);
    }
  };

  const getTimeRemaining = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const hoursPassed = (now - created) / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, 24 - hoursPassed);
    return hoursRemaining.toFixed(1);
  };

  const handleSavePaymentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update payment settings in database
      const settingsToUpdate = [
        { setting_key: "upi_id", setting_value: paymentSettings.upiId },
        { setting_key: "qr_code_url", setting_value: paymentSettings.qrCodeUrl },
        { setting_key: "account_name", setting_value: paymentSettings.accountName },
        { setting_key: "account_number", setting_value: paymentSettings.accountNumber },
        { setting_key: "ifsc_code", setting_value: paymentSettings.ifsc },
        { setting_key: "bank_name", setting_value: paymentSettings.bankName },
        { setting_key: "exchange_rate", setting_value: paymentSettings.exchangeRate },
        { setting_key: "app_download_url", setting_value: paymentSettings.appDownloadUrl },
        { setting_key: "max_leverage", setting_value: paymentSettings.maxLeverage || "100" },
        // Deposit offer settings
        { setting_key: "deposit_bonus_enabled", setting_value: String(depositOfferSettings.bonusEnabled) },
        { setting_key: "deposit_bonus_percentage", setting_value: depositOfferSettings.bonusPercentage },
        { setting_key: "deposit_min_amount", setting_value: depositOfferSettings.minAmount },
        { setting_key: "deposit_max_amount", setting_value: depositOfferSettings.maxAmount },
        { setting_key: "deposit_bonus_max", setting_value: depositOfferSettings.bonusMax },
        { setting_key: "deposit_offer_title", setting_value: depositOfferSettings.offerTitle },
        // Market settings
        { setting_key: "forex_enabled", setting_value: String(marketSettings.forexEnabled) },
        { setting_key: "commodities_enabled", setting_value: String(marketSettings.commoditiesEnabled) },
        { setting_key: "forex_momentum_enabled", setting_value: String(marketSettings.forexMomentumEnabled) },
        { setting_key: "commodities_momentum_enabled", setting_value: String(marketSettings.commoditiesMomentumEnabled) },
      ];

      // Only update API password if a new one was entered
      if (paymentSettings.apiPassword && paymentSettings.apiPassword.trim() !== "") {
        settingsToUpdate.push({ setting_key: "api_management_password", setting_value: paymentSettings.apiPassword.trim() });
      }


      for (const setting of settingsToUpdate) {
        const { error } = await supabase
          .from("payment_settings")
          .upsert({
            setting_key: setting.setting_key,
            setting_value: setting.setting_value,
            updated_by: user.id,
          }, {
            onConflict: 'setting_key'
          });

        if (error) throw error;
      }

      toast({
        title: "Settings Saved",
        description: "Payment and deposit offer settings updated successfully",
      });

      // Refresh data to show updated values
      await fetchAllData();
      setSettingsOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Real-time subscription for deposit and withdrawal requests
  useEffect(() => {
    if (!isAdmin) return;

    const depositChannel = supabase
      .channel('admin-deposit-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposit_requests'
        },
        () => {
          // Refresh deposit requests when any change occurs
          fetchAllData();
        }
      )
      .subscribe();

    const withdrawalChannel = supabase
      .channel('admin-withdrawal-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'withdrawal_requests'
        },
        () => {
          // Refresh withdrawal requests when any change occurs
          fetchAllData();
        }
      )
      .subscribe();

    const kycChannel = supabase
      .channel('admin-kyc-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kyc_submissions' },
        () => fetchAllData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(depositChannel);
      supabase.removeChannel(withdrawalChannel);
      supabase.removeChannel(kycChannel);
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Verifying broker access...</p>
      </div>
    );
  }

  // Compute pending counts for sidebar badges
  const pendingDepositsCount = depositRequests.filter((d: any) => d.status === "pending" || d.status === "locked").length;
  const pendingWithdrawalsCount = withdrawalRequests.filter((w: any) => w.status === "pending").length;

  return (
    <SidebarProvider defaultOpen={typeof window !== "undefined" ? window.innerWidth >= 1024 : true}>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-primary/5">
        {/* Decorative animated background orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl animate-pulse" />
          <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-accent/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingApprovalsCount={pendingUsers.length}
          pendingDepositsCount={pendingDepositsCount}
          pendingWithdrawalsCount={pendingWithdrawalsCount}
          pendingKycCount={pendingKycCount}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Premium Header */}
          <header className="border-b border-border/40 backdrop-blur-xl bg-background/70 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <SidebarTrigger className="hover:bg-primary/10 hover:text-primary transition-colors rounded-lg shrink-0" />
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-accent shrink-0" />
                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent capitalize truncate">
                      {activeTab === "api" ? "API Keys" : activeTab}
                    </h1>
                    <p className="hidden sm:block text-[11px] text-muted-foreground">Broker management console</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchAllData}
                  className="h-9 w-9 sm:hidden border-primary/30 hover:bg-primary/10"
                  aria-label="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAllData}
                  className="hidden sm:flex border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="hover:bg-primary/10 hover:text-primary transition-colors px-2 sm:px-3"
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-2 py-3 sm:px-4 sm:py-6 lg:px-8 lg:py-8 overflow-x-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full animate-fade-in">
              {/* TabsList hidden — navigation handled by sidebar */}
              <TabsList className="sr-only">
                <TabsTrigger value="approvals">Approvals</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="trades">Trades</TabsTrigger>
                <TabsTrigger value="signals">Signals</TabsTrigger>
                <TabsTrigger value="api">API Keys</TabsTrigger>
                <TabsTrigger value="deposits">Deposits</TabsTrigger>
                <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
                <TabsTrigger value="kyc">KYC</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

          {/* User Approvals Tab */}
          <TabsContent value="approvals">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      User Approvals
                    </CardTitle>
                    <CardDescription>Activate or deactivate user accounts</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {pendingUsers.length} Pending
                    </Badge>
                    <Button onClick={fetchAllData} variant="outline" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading users...</p>
                ) : (
                  <div className="space-y-6">
                    {/* Pending Users */}
                    {pendingUsers.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 text-amber-600">Pending Approval ({pendingUsers.length})</h3>
                        <div className="overflow-x-auto -mx-2 px-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Mobile</TableHead>
                              <TableHead>Signup Date</TableHead>
                              <TableHead>Time Remaining</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pendingUsers.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                  {user.full_name || "N/A"}
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {user.mobile_number || "N/A"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(user.created_at).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {getTimeRemaining(user.created_at)}h left
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveUser(user.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Activate
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                      </div>
                    )}
                    
                    {/* Active Users */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-green-600">Active Users ({users.filter(u => u.is_approved).length})</h3>
                      <div className="overflow-x-auto -mx-2 px-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Mobile</TableHead>
                            <TableHead>Activated Date</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.filter(u => u.is_approved).map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">
                                {user.full_name || "N/A"}
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {user.mobile_number || "N/A"}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {user.approved_at ? new Date(user.approved_at).toLocaleString() : "N/A"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeactivateUser(user.id)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Deactivate
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Management
                    </CardTitle>
                    <CardDescription>View and manage all registered users</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, email, mobile..."
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          setUserCurrentPage(1); // Reset to first page on search
                        }}
                        className="pl-9"
                      />
                    </div>
                    <Button onClick={fetchAllData} variant="outline" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading users...</p>
                ) : (() => {
                  // Filter users based on search query
                  const filteredUsers = users.filter(user => {
                    if (!userSearchQuery.trim()) return true;
                    const query = userSearchQuery.toLowerCase();
                    return (
                      (user.full_name?.toLowerCase().includes(query)) ||
                      (user.email?.toLowerCase().includes(query)) ||
                      (user.mobile_number?.toLowerCase().includes(query))
                    );
                  });

                  // Pagination
                  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
                  const startIndex = (userCurrentPage - 1) * USERS_PER_PAGE;
                  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);

                  if (filteredUsers.length === 0) {
                    return (
                      <p className="text-center py-8 text-muted-foreground">
                        {userSearchQuery ? `No users found matching "${userSearchQuery}"` : "No users found"}
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Results info */}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                          Showing {startIndex + 1}-{Math.min(startIndex + USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
                        </span>
                        {totalPages > 1 && (
                          <span>Page {userCurrentPage} of {totalPages}</span>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Mobile</TableHead>
                              <TableHead>Balance (USD)</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedUsers.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                  {user.full_name || "N/A"}
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {user.mobile_number || "N/A"}
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold">
                                  ${getUserBalance(user.id)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(user.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2 flex-wrap">
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => {
                                        setAddFundUser(user);
                                        setAddFundAmount("");
                                        setAddFundOpen(true);
                                      }}
                                    >
                                      <DollarSign className="h-4 w-4 mr-1" />
                                      Add Fund
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditBalance(user)}
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Balance
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setPasswordUser(user);
                                        setChangePasswordOpen(true);
                                      }}
                                    >
                                      <Lock className="h-4 w-4 mr-1" />
                                      Password
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        setUserToDelete(user);
                                        setDeleteUserOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUserCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={userCurrentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (userCurrentPage <= 3) {
                                pageNum = i + 1;
                              } else if (userCurrentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = userCurrentPage - 2 + i;
                              }
                              return (
                                <Button
                                  key={pageNum}
                                  variant={userCurrentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setUserCurrentPage(pageNum)}
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUserCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={userCurrentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trades Tab */}
          <TabsContent value="trades">
            <AdminTradeManagement />
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals">
            <AdminSignalsManagement />
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <AdminAuditLog />
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api">
            <AdminAPIManagement />
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Deposit Management
                    </CardTitle>
                    <CardDescription>Review and approve deposit requests</CardDescription>
                  </div>
                  <Button onClick={fetchAllData} variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading deposits...</p>
                ) : depositRequests.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No deposit requests</p>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2"><Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depositRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {request.profiles?.full_name || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.profiles?.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            <div>
                              <div>{request.currency === "INR" ? "₹" : "$"}{Number(request.amount).toFixed(2)}</div>
                              {request.currency === "INR" && (
                                <div className="text-xs text-muted-foreground">
                                  ≈ ${(Number(request.amount) * parseFloat(paymentSettings.exchangeRate || "0.012")).toFixed(2)} USD
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
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {request.transaction_id}
                            </code>
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
                            <div>{new Date(request.created_at).toLocaleDateString()}</div>
                            <div className="text-xs">{new Date(request.created_at).toLocaleTimeString()}</div>
                          </TableCell>
                          <TableCell>
                            {(request.status === "pending" || request.status === "locked") && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveDeposit(request.id)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  {request.status === "locked" ? "Verify & Approve" : "Approve"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRejectDeposit(request.id)}
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
                  </Table></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpRight className="h-5 w-5" />
                      Withdrawal Management
                    </CardTitle>
                    <CardDescription>Review and approve withdrawal requests</CardDescription>
                  </div>
                  <Button onClick={fetchAllData} variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading withdrawals...</p>
                ) : withdrawalRequests.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No withdrawal requests</p>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2"><Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Account Details</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawalRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {request.profiles?.full_name || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.profiles?.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ${Number(request.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {request.withdrawal_method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {request.withdrawal_method === "bank" ? (
                                <>
                                  <div><strong>Name:</strong> {request.account_details.accountName}</div>
                                  <div><strong>Acc:</strong> {request.account_details.accountNumber}</div>
                                  <div><strong>IFSC:</strong> {request.account_details.ifscCode}</div>
                                  <div><strong>Bank:</strong> {request.account_details.bankName}</div>
                                </>
                              ) : (
                                <div><strong>UPI:</strong> {request.account_details.upiId}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                request.status === "approved"
                                  ? "default"
                                  : request.status === "rejected"
                                  ? "destructive"
                                  : request.status === "processing"
                                  ? "secondary"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div>{new Date(request.created_at).toLocaleDateString()}</div>
                            <div className="text-xs">{new Date(request.created_at).toLocaleTimeString()}</div>
                          </TableCell>
                          <TableCell>
                            {request.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedWithdrawal(request);
                                    setApproveWithdrawalOpen(true);
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedWithdrawal(request);
                                    setRejectWithdrawalOpen(true);
                                  }}
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
                  </Table></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KYC Management Tab */}
          <TabsContent value="kyc">
            <AdminKYCManagement />
          </TabsContent>

          {/* Payment Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Payment Settings
                </CardTitle>
                <CardDescription>Configure UPI and bank transfer details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* UPI Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    UPI Settings
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="upiId">UPI ID</Label>
                    <Input
                      id="upiId"
                      value={paymentSettings.upiId}
                      onChange={(e) =>
                        setPaymentSettings({ ...paymentSettings, upiId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>QR Code Image</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={uploadingQr}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          if (file.size > 5 * 1024 * 1024) {
                            toast({
                              title: "Error",
                              description: "File size must be less than 5MB",
                              variant: "destructive",
                            });
                            return;
                          }

                          setUploadingQr(true);
                          try {
                            const fileExt = file.name.split('.').pop();
                            const fileName = `qr-code-${Date.now()}.${fileExt}`;
                            
                            const { error: uploadError } = await supabase.storage
                              .from('payment-qrcodes')
                              .upload(fileName, file, { upsert: true });

                            if (uploadError) throw uploadError;

                            const { data: { publicUrl } } = supabase.storage
                              .from('payment-qrcodes')
                              .getPublicUrl(fileName);

                            setPaymentSettings({ ...paymentSettings, qrCodeUrl: publicUrl });
                            toast({
                              title: "Success",
                              description: "QR code uploaded successfully",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Upload Failed",
                              description: error.message,
                              variant: "destructive",
                            });
                          } finally {
                            setUploadingQr(false);
                          }
                        }}
                        className="flex-1"
                      />
                      {uploadingQr && <Loader2 className="h-5 w-5 animate-spin" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload your custom QR code image (max 5MB). Leave empty to auto-generate from UPI ID.
                    </p>
                    {paymentSettings.qrCodeUrl && (
                      <div className="flex items-start gap-4 mt-3">
                        <div className="p-2 border rounded-lg bg-white">
                          <img 
                            src={paymentSettings.qrCodeUrl} 
                            alt="QR Code Preview" 
                            className="w-32 h-32 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '';
                            }}
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setPaymentSettings({ ...paymentSettings, qrCodeUrl: "" })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bank Transfer Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Bank Transfer Settings
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="accountName">Account Name</Label>
                      <Input
                        id="accountName"
                        value={paymentSettings.accountName}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, accountName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        value={paymentSettings.accountNumber}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, accountNumber: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ifsc">IFSC Code</Label>
                      <Input
                        id="ifsc"
                        value={paymentSettings.ifsc}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, ifsc: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        value={paymentSettings.bankName}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, bankName: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Exchange Rate Settings */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                    USD Conversion Rate
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="exchangeRate">INR → USD Rate</Label>
                      <Input
                        id="exchangeRate"
                        type="number"
                        step="0.0001"
                        min="0"
                        placeholder="0.012"
                        value={paymentSettings.exchangeRate}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, exchangeRate: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        1 INR = {paymentSettings.exchangeRate} USD &nbsp;•&nbsp; ₹1000 ≈ ${(1000 * parseFloat(paymentSettings.exchangeRate || "0.012")).toFixed(2)} &nbsp;•&nbsp; 1 USD ≈ ₹{(1 / parseFloat(paymentSettings.exchangeRate || "0.012")).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Yeh rate users ke deposit conversion (INR → USD wallet credit) ke liye use hota hai. Save Settings dabane ke baad turant lagu ho jayega.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Global Leverage Cap */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                    Global Leverage Cap
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxLeverage">Maximum Leverage (1x – 100x)</Label>
                      <Input
                        id="maxLeverage"
                        type="number"
                        step="1"
                        min="1"
                        max="100"
                        placeholder="100"
                        value={paymentSettings.maxLeverage}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") { setPaymentSettings({ ...paymentSettings, maxLeverage: "" }); return; }
                          const n = Math.max(1, Math.min(100, parseInt(v) || 1));
                          setPaymentSettings({ ...paymentSettings, maxLeverage: n.toString() });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Default cap applied to all users (1–100). Per-user override Broker Dashboard se set kar sakte hain.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mobile App Upload Settings — HIDDEN (kept in code) */}
                {false && (
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-purple-500" />
                    Mobile App Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upload APK/App File</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".apk,.ipa,.zip"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            if (file.size > 100 * 1024 * 1024) {
                              toast({
                                title: "Error",
                                description: "File size must be less than 100MB",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            setUploadingApp(true);
                            try {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `tradixofx-app.${fileExt}`;
                              
                              // Delete old file if exists
                              await supabase.storage.from('app-files').remove([fileName]);
                              
                              const { data, error } = await supabase.storage
                                .from('app-files')
                                .upload(fileName, file, { upsert: true });
                              
                              if (error) throw error;
                              
                              const { data: urlData } = supabase.storage
                                .from('app-files')
                                .getPublicUrl(fileName);
                              
                              const newAppUrl = urlData.publicUrl;
                              setPaymentSettings({ ...paymentSettings, appDownloadUrl: newAppUrl });
                              
                              // Auto-save the URL to database
                              const { data: { user } } = await supabase.auth.getUser();
                              if (user) {
                                await supabase
                                  .from("payment_settings")
                                  .upsert({
                                    setting_key: "app_download_url",
                                    setting_value: newAppUrl,
                                    updated_by: user.id,
                                  }, {
                                    onConflict: 'setting_key'
                                  });
                              }
                              
                              toast({
                                title: "Success",
                                description: "App file uploaded and saved successfully",
                              });
                            } catch (error: any) {
                              toast({
                                title: "Error",
                                description: error.message,
                                variant: "destructive",
                              });
                            } finally {
                              setUploadingApp(false);
                            }
                          }}
                          className="cursor-pointer"
                        />
                        {uploadingApp && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload APK file for Android users (max 100MB)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="appDownloadUrl">Or Enter Direct Download URL</Label>
                      <Input
                        id="appDownloadUrl"
                        placeholder="https://example.com/app.apk"
                        value={paymentSettings.appDownloadUrl}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, appDownloadUrl: e.target.value })
                        }
                      />
                    </div>
                    
                    {paymentSettings.appDownloadUrl && (
                      <div className="p-3 bg-purple-600/10 border border-purple-600/20 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4 text-purple-500" />
                          <span className="text-sm">App download link is active</span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(paymentSettings.appDownloadUrl, '_blank')}
                        >
                          Test Download
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* Market Settings — HIDDEN (kept in code) */}
                {false && (
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    Market Availability
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Control which markets are available to users on the Dashboard
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <div>
                          <Label className="text-base font-medium">Forex Market</Label>
                          <p className="text-sm text-muted-foreground">EUR/USD, GBP/USD, JPY/USD, etc.</p>
                        </div>
                      </div>
                      <Switch
                        checked={marketSettings.forexEnabled}
                        onCheckedChange={(checked) =>
                          setMarketSettings({ ...marketSettings, forexEnabled: checked })
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Gem className="h-5 w-5 text-yellow-500" />
                        <div>
                          <Label className="text-base font-medium">Commodities Market</Label>
                          <p className="text-sm text-muted-foreground">Gold, Silver, Crude Oil, etc.</p>
                        </div>
                      </div>
                      <Switch
                        checked={marketSettings.commoditiesEnabled}
                        onCheckedChange={(checked) =>
                          setMarketSettings({ ...marketSettings, commoditiesEnabled: checked })
                        }
                      />
                    </div>
                  </div>
                  
                  {(!marketSettings.forexEnabled || !marketSettings.commoditiesEnabled) && (
                    <div className="p-3 bg-amber-600/10 border border-amber-600/20 rounded-lg">
                      <p className="text-sm text-amber-600 font-medium">
                        {!marketSettings.forexEnabled && !marketSettings.commoditiesEnabled
                          ? "Both Forex and Commodities markets are disabled"
                          : !marketSettings.forexEnabled
                          ? "Forex market is disabled for users"
                          : "Commodities market is disabled for users"}
                      </p>
                    </div>
                  )}
                </div>
                )}

                {/* Momentum Control — HIDDEN (kept in code) */}
                {false && (
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    Momentum Control
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Control price momentum animations for each market type on the Dashboard
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <div>
                          <Label className="text-base font-medium">Forex Momentum</Label>
                          <p className="text-sm text-muted-foreground">Enable/disable price animations for Forex pairs</p>
                        </div>
                      </div>
                      <Switch
                        checked={marketSettings.forexMomentumEnabled}
                        onCheckedChange={(checked) =>
                          setMarketSettings({ ...marketSettings, forexMomentumEnabled: checked })
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Gem className="h-5 w-5 text-yellow-500" />
                        <div>
                          <Label className="text-base font-medium">Commodities Momentum</Label>
                          <p className="text-sm text-muted-foreground">Enable/disable price animations for Commodities</p>
                        </div>
                      </div>
                      <Switch
                        checked={marketSettings.commoditiesMomentumEnabled}
                        onCheckedChange={(checked) =>
                          setMarketSettings({ ...marketSettings, commoditiesMomentumEnabled: checked })
                        }
                      />
                    </div>
                  </div>
                  
                  {(!marketSettings.forexMomentumEnabled || !marketSettings.commoditiesMomentumEnabled) && (
                    <div className="p-3 bg-purple-600/10 border border-purple-600/20 rounded-lg">
                      <p className="text-sm text-purple-600 font-medium">
                        {!marketSettings.forexMomentumEnabled && !marketSettings.commoditiesMomentumEnabled
                          ? "Momentum is disabled for both Forex and Commodities"
                          : !marketSettings.forexMomentumEnabled
                          ? "Forex momentum animations are disabled"
                          : "Commodities momentum animations are disabled"}
                      </p>
                    </div>
                  )}
                </div>
                )}

                {/* Deposit Offer Settings */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Gift className="h-5 w-5 text-green-500" />
                    Deposit Offer Settings
                  </h3>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <input
                      type="checkbox"
                      id="bonusEnabled"
                      checked={depositOfferSettings.bonusEnabled}
                      onChange={(e) =>
                        setDepositOfferSettings({ ...depositOfferSettings, bonusEnabled: e.target.checked })
                      }
                      className="h-5 w-5 rounded border-border"
                    />
                    <Label htmlFor="bonusEnabled" className="cursor-pointer">
                      Enable Deposit Bonus
                    </Label>
                  </div>
                  
                  {depositOfferSettings.bonusEnabled && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="offerTitle">Offer Title</Label>
                        <Input
                          id="offerTitle"
                          placeholder="e.g., Christmas Bonus"
                          value={depositOfferSettings.offerTitle}
                          onChange={(e) =>
                            setDepositOfferSettings({ ...depositOfferSettings, offerTitle: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bonusPercentage">Bonus Percentage (%)</Label>
                        <Input
                          id="bonusPercentage"
                          type="number"
                          min="0"
                          max="100"
                          value={depositOfferSettings.bonusPercentage}
                          onChange={(e) =>
                            setDepositOfferSettings({ ...depositOfferSettings, bonusPercentage: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="minAmount">Minimum Deposit Amount ($)</Label>
                        <Input
                          id="minAmount"
                          type="number"
                          min="0"
                          value={depositOfferSettings.minAmount}
                          onChange={(e) =>
                            setDepositOfferSettings({ ...depositOfferSettings, minAmount: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxAmount">Maximum Deposit Amount ($)</Label>
                        <Input
                          id="maxAmount"
                          type="number"
                          min="0"
                          value={depositOfferSettings.maxAmount}
                          onChange={(e) =>
                            setDepositOfferSettings({ ...depositOfferSettings, maxAmount: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="bonusMax">Maximum Bonus Amount ($)</Label>
                        <Input
                          id="bonusMax"
                          type="number"
                          min="0"
                          value={depositOfferSettings.bonusMax}
                          onChange={(e) =>
                            setDepositOfferSettings({ ...depositOfferSettings, bonusMax: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum bonus a user can receive regardless of deposit amount
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {depositOfferSettings.bonusEnabled && (
                    <div className="p-4 bg-green-600/10 border border-green-600/20 rounded-lg">
                      <p className="text-sm font-medium text-green-600">
                        Current Offer: {depositOfferSettings.offerTitle} - {depositOfferSettings.bonusPercentage}% bonus
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        For deposits between ${depositOfferSettings.minAmount} - ${depositOfferSettings.maxAmount} (max bonus: ${depositOfferSettings.bonusMax})
                      </p>
                    </div>
                  )}
                </div>


                {/* Broker Panel API Password — HIDDEN (kept in code) */}
                {false && (
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Lock className="h-5 w-5 text-red-500" />
                    Broker Panel API Password
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Change the password used to unlock API Key Management section
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="apiPassword">New Password</Label>
                      <Input
                        id="apiPassword"
                        type="password"
                        placeholder="Enter new API management password"
                        value={paymentSettings.apiPassword || ""}
                        onChange={(e) =>
                          setPaymentSettings({ ...paymentSettings, apiPassword: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to keep the current password unchanged
                      </p>
                    </div>
                  </div>
                </div>
                )}

                {/* Login Password Change — HIDDEN (kept in code) */}
                {false && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Lock className="h-5 w-5 text-orange-500" />
                    Login Password Change
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Change your login password for this broker account
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="newLoginPassword">New Login Password</Label>
                      <Input
                        id="newLoginPassword"
                        type="password"
                        placeholder="Enter new login password"
                        value={newLoginPassword}
                        onChange={(e) => setNewLoginPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmLoginPassword">Confirm Password</Label>
                      <Input
                        id="confirmLoginPassword"
                        type="password"
                        placeholder="Confirm new login password"
                        value={confirmLoginPassword}
                        onChange={(e) => setConfirmLoginPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleChangeLoginPassword} 
                    variant="outline"
                    disabled={changingLoginPassword || !newLoginPassword}
                    className="w-full"
                  >
                    {changingLoginPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                    Change Login Password
                  </Button>
                </div>
                )}

                <Button onClick={handleSavePaymentSettings} className="w-full">
                  Save All Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>


      {/* Edit Balance Dialog */}
      <Dialog open={editBalanceOpen} onOpenChange={setEditBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Balance</DialogTitle>
            <DialogDescription>
              Update the balance for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="balance">Balance (USD)</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBalanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBalance}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {userToDelete?.full_name || userToDelete?.email} and all
              their data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Withdrawal Dialog */}
      <Dialog open={approveWithdrawalOpen} onOpenChange={setApproveWithdrawalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Withdrawal</DialogTitle>
            <DialogDescription>
              Approve withdrawal request for {selectedWithdrawal?.profiles?.full_name || selectedWithdrawal?.profiles?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Withdrawal Amount</Label>
              <div className="font-semibold text-lg">
                ${Number(selectedWithdrawal?.amount || 0).toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transactionRef">Transaction Reference (Optional)</Label>
              <Input
                id="transactionRef"
                placeholder="Enter transaction reference number"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Add a reference number for tracking purposes
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveWithdrawalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveWithdrawal} className="bg-green-600 hover:bg-green-700">
              Approve Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Withdrawal Dialog */}
      <Dialog open={rejectWithdrawalOpen} onOpenChange={setRejectWithdrawalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this withdrawal request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Withdrawal Amount</Label>
              <div className="font-semibold text-lg">
                ${Number(selectedWithdrawal?.amount || 0).toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Enter reason for rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectWithdrawalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRejectWithdrawal} variant="destructive">
              Reject Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordUser?.full_name || passwordUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChangePasswordOpen(false);
              setPasswordUser(null);
              setNewPassword("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword || newPassword.length < 6}
            >
              {changingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Fund Dialog */}
      <Dialog open={addFundOpen} onOpenChange={setAddFundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Add Fund to User Wallet
            </DialogTitle>
            <DialogDescription>
              Add funds to {addFundUser?.full_name || addFundUser?.email}'s wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-2xl font-bold">${addFundUser ? getUserBalance(addFundUser.id) : "0.00"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addFundAmount">Amount to Add (USD)</Label>
              <Input
                id="addFundAmount"
                type="number"
                placeholder="Enter amount"
                value={addFundAmount}
                onChange={(e) => setAddFundAmount(e.target.value)}
                min="0.01"
                step="0.01"
              />
            </div>
            {addFundAmount && parseFloat(addFundAmount) > 0 && (
              <div className="p-3 bg-green-600/10 border border-green-600/20 rounded-lg">
                <p className="text-sm text-muted-foreground">New Balance</p>
                <p className="text-xl font-bold text-green-600">
                  ${(parseFloat(getUserBalance(addFundUser?.id || "")) + parseFloat(addFundAmount || "0")).toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddFundOpen(false);
              setAddFundUser(null);
              setAddFundAmount("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddFund} 
              disabled={addingFund || !addFundAmount || parseFloat(addFundAmount) <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {addingFund ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-1" />
                  Add Fund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
            </Tabs>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminPanel;
