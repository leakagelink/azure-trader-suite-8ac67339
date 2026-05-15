import { TrendingUp, Wallet, User, Layers, Newspaper, Zap } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: TrendingUp, label: "Trade", path: "/dashboard" },
    { icon: Layers, label: "Positions", path: "/positions" },
    { icon: Zap, label: "Signals", path: "/signals" },
    { icon: Newspaper, label: "News", path: "/news" },
    { icon: Wallet, label: "Wallet", path: "/wallet" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      {/* Gradient top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      {/* Glass background */}
      <div className="absolute inset-0 backdrop-blur-2xl bg-background/80 border-t border-border/50" />
      {/* Subtle glow */}
      <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      <div className="relative flex items-center justify-around h-16 max-w-7xl mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center gap-0.5 px-1.5 py-2 min-w-0 flex-1 group transition-all duration-300"
              aria-label={item.label}
            >
              {/* Active indicator dot on top */}
              {active && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-primary via-secondary to-accent shadow-[0_0_12px_hsl(var(--accent)/0.6)] animate-fade-in" />
              )}

              {/* Icon container */}
              <div
                className={`relative flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-300 ${
                  active
                    ? "bg-gradient-to-br from-primary/20 via-secondary/15 to-accent/20 border border-accent/40 shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.4)] scale-105"
                    : "group-hover:bg-muted/60 group-active:scale-95"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] transition-all duration-300 ${
                    active
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                  strokeWidth={active ? 2.4 : 2}
                />
              </div>

              <span
                className={`text-[10px] font-semibold tracking-wide transition-all duration-300 ${
                  active
                    ? "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
