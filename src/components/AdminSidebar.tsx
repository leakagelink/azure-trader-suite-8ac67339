import {
  Shield,
  Users,
  TrendingUp,
  Settings,
  Wallet,
  ArrowUpRight,
  FileText,
  SettingsIcon,
  LogOut,
  LayoutDashboard,
  Zap,
  History,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingApprovalsCount?: number;
  pendingDepositsCount?: number;
  pendingWithdrawalsCount?: number;
  pendingKycCount?: number;
}

const operationsItems = [
  { id: "approvals", title: "Approvals", icon: Shield, badgeKey: "approvals" },
  { id: "users", title: "Users", icon: Users },
  { id: "trades", title: "Trades", icon: TrendingUp },
  { id: "signals", title: "Signals", icon: Zap },
  { id: "kyc", title: "KYC", icon: FileText, badgeKey: "kyc" },
  { id: "audit", title: "Audit Log", icon: History },
];

const transactionsItems = [
  { id: "deposits", title: "Deposits", icon: Wallet, badgeKey: "deposits" },
  { id: "withdrawals", title: "Withdrawals", icon: ArrowUpRight, badgeKey: "withdrawals" },
];

const systemItems = [
  // { id: "api", title: "API Keys", icon: Settings }, // Hidden — kept for future use
  { id: "settings", title: "Settings", icon: SettingsIcon },
];

export function AdminSidebar({
  activeTab,
  onTabChange,
  pendingApprovalsCount = 0,
  pendingDepositsCount = 0,
  pendingWithdrawalsCount = 0,
  pendingKycCount = 0,
}: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  const getBadgeCount = (key?: string) => {
    switch (key) {
      case "approvals":
        return pendingApprovalsCount;
      case "deposits":
        return pendingDepositsCount;
      case "withdrawals":
        return pendingWithdrawalsCount;
      case "kyc":
        return pendingKycCount;
      default:
        return 0;
    }
  };

  const renderItem = (item: typeof operationsItems[number]) => {
    const isActive = activeTab === item.id;
    const badgeCount = getBadgeCount((item as any).badgeKey);

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          onClick={() => onTabChange(item.id)}
          isActive={isActive}
          className={`group relative transition-all duration-300 ${
            isActive
              ? "bg-gradient-to-r from-primary/20 to-accent/20 text-primary font-semibold shadow-sm border-l-2 border-primary"
              : "hover:bg-muted/60 hover:translate-x-1"
          }`}
          tooltip={collapsed ? item.title : undefined}
        >
          <item.icon
            className={`h-4 w-4 transition-transform ${
              isActive ? "scale-110 text-primary" : "group-hover:scale-110"
            }`}
          />
          {!collapsed && (
            <>
              <span className="flex-1">{item.title}</span>
              {badgeCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-auto h-5 min-w-5 px-1.5 bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] font-bold animate-pulse"
                >
                  {badgeCount}
                </Badge>
              )}
            </>
          )}
          {collapsed && badgeCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent animate-pulse" />
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="border-b border-border/40 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-full blur-md opacity-50 animate-pulse" />
            <img
              src={logo}
              alt="TradixoFX"
              className="relative h-9 w-9 object-contain rounded-full ring-2 ring-primary/30"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col animate-fade-in min-w-0">
              <span className="text-sm font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
                TradixoFX
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Broker Panel
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-gradient-to-b from-background via-background to-primary/5">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
              Operations
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{operationsItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
              Transactions
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{transactionsItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
              System
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{systemItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 bg-gradient-to-t from-primary/5 to-transparent">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate("/dashboard")}
              tooltip={collapsed ? "Dashboard" : undefined}
              className="hover:bg-muted/60 transition-all"
            >
              <LayoutDashboard className="h-4 w-4" />
              {!collapsed && <span>Dashboard</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                const { supabase } = await import("@/integrations/supabase/client");
                await supabase.auth.signOut();
                navigate("/auth");
              }}
              tooltip={collapsed ? "Sign Out" : undefined}
              className="hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
