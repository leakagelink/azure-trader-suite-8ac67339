import { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import BottomNav from "@/components/BottomNav";

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  headerAction?: ReactNode;
  children: ReactNode;
  maxWidth?: "2xl" | "4xl" | "6xl" | "7xl" | "wide" | "full";
}

const maxWidthMap = {
  "2xl": "max-w-2xl lg:max-w-4xl",
  "4xl": "max-w-4xl lg:max-w-5xl",
  "6xl": "max-w-6xl lg:max-w-[1500px]",
  "7xl": "max-w-7xl lg:max-w-[1600px]",
  "wide": "max-w-7xl lg:max-w-[1700px] xl:max-w-[1800px]",
  "full": "max-w-full",
};

const PageShell = ({
  title,
  subtitle,
  icon: Icon,
  headerAction,
  children,
  maxWidth = "4xl",
}: PageShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-muted/40 to-background">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute top-1/3 -right-40 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[140px] animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-[450px] h-[450px] bg-secondary/15 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 relative">
        <div className="absolute inset-0 backdrop-blur-2xl bg-background/75 border-b border-border/50" />
        <div className="absolute inset-x-0 -bottom-6 h-6 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

        <div className="relative flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl hover:bg-gradient-to-br hover:from-primary/15 hover:to-accent/15 hover:text-primary transition-all duration-300"
              onClick={() => navigate("/dashboard")}
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div
              className="flex items-center gap-2 group cursor-pointer"
              onClick={() => navigate("/dashboard")}
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-accent/30 to-secondary/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img
                  src={logo}
                  alt="TradixoFX"
                  className="relative h-11 w-auto sm:h-14 object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>
          </div>
          {headerAction && (
            <div className="flex items-center gap-1 sm:gap-1.5">{headerAction}</div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`relative z-10 container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-6 sm:py-8 ${maxWidthMap[maxWidth]} pb-24`}>
        {/* Hero Title */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-accent/30 to-secondary/30 blur-2xl opacity-60" />
            <h1 className="relative text-2xl sm:text-3xl md:text-4xl font-bold mb-2 tracking-tight flex items-center gap-3">
              {Icon && (
                <span className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-accent/30">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </span>
              )}
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                {title}
              </span>
            </h1>
          </div>
          {subtitle && (
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-primary to-accent" />
              <p className="text-sm sm:text-base text-muted-foreground">{subtitle}</p>
            </div>
          )}
        </div>

        <div className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default PageShell;

/* Reusable glass-card wrapper class string for consistency */
export const glassCardClass =
  "relative rounded-2xl bg-card/60 backdrop-blur-xl border border-border/60 shadow-xl overflow-hidden";
