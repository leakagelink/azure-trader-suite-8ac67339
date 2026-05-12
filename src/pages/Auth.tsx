import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowLeft,
  Eye,
  EyeOff,
  Hash,
  Shield,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Globe,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import logo from "@/assets/logo.png";

const signInSchema = z.object({
  identifier: z.string().min(1, "Email, Mobile or Client ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  mobileNumber: z.string().min(10, "Mobile number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const identifier = (formData.get("identifier") as string).trim();
    const password = formData.get("password") as string;

    try {
      signInSchema.parse({ identifier, password });
      let email = identifier;

      if (!identifier.includes("@")) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .or(`mobile_number.eq.${identifier},client_id.eq.${identifier.toUpperCase()}`)
          .maybeSingle();

        if (profileError) {
          toast.error("Error looking up account");
          setIsLoading(false);
          return;
        }
        if (!profileData?.email) {
          toast.error("No account found with this mobile number or client ID");
          setIsLoading(false);
          return;
        }
        email = profileData.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(
          error.message.includes("Invalid login credentials")
            ? "Invalid credentials. Please check your password."
            : error.message
        );
        return;
      }
      if (data.user) {
        toast.success("Welcome back!");
        navigate("/dashboard");
      }
    } catch (error) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message);
      else toast.error("An error occurred during sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("name") as string;
    const email = formData.get("email") as string;
    const mobileNumber = formData.get("mobile") as string;
    const password = formData.get("password") as string;

    try {
      signUpSchema.parse({ fullName, email, mobileNumber, password });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, mobile_number: mobileNumber },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(
          error.message.includes("User already registered")
            ? "This email is already registered. Please sign in instead."
            : error.message
        );
        return;
      }
      if (data.user) {
        toast.success("Account created! Awaiting broker approval.");
        navigate("/pending-approval");
      }
    } catch (error) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message);
      else toast.error("An error occurred during sign up");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password reset email sent! Please check your inbox.");
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Premium animated background — used by both forms
  const AnimatedBackground = () => (
    <>
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/10" />
      {/* Floating orbs */}
      <div className="absolute top-0 -left-40 w-[500px] h-[500px] bg-primary/30 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-0 -right-40 w-[500px] h-[500px] bg-accent/30 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "2s" }}
      />
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-accent/50 animate-bounce"
          style={{
            top: `${15 + i * 13}%`,
            left: `${10 + i * 14}%`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${3 + i * 0.5}s`,
          }}
        />
      ))}
    </>
  );

  // Left brand panel — shown on desktop only
  const BrandPanel = () => (
    <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
      <div className="relative z-10 animate-fade-in">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 group cursor-pointer"
        >
          <img
            src={logo}
            alt="TradixoFX"
            className="h-14 w-auto object-contain transition-transform group-hover:scale-110"
          />
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              TradixoFX
            </h1>
            <p className="text-xs text-muted-foreground tracking-wider">PREMIUM TRADING</p>
          </div>
        </button>
      </div>

      <div className="relative z-10 space-y-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <Badge className="bg-primary/10 text-primary border border-primary/30 px-4 py-2 text-sm font-semibold backdrop-blur-md">
          <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
          Trusted by 50,000+ Traders
        </Badge>

        <div>
          <h2 className="text-5xl xl:text-6xl font-black leading-tight">
            Trade <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">Smarter</span>
            <br />
            Earn <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Bigger</span>
          </h2>
          <p className="text-lg text-muted-foreground mt-4 max-w-md">
            Join the world's most trusted platform for Crypto, Forex & Commodities trading.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {[
            { icon: Shield, title: "Bank-Grade Security", desc: "256-bit SSL & 2FA protection" },
            { icon: Zap, title: "Lightning-Fast Execution", desc: "Sub-millisecond order matching" },
            { icon: Globe, title: "150+ Global Markets", desc: "Crypto, Forex, Gold & Commodities" },
          ].map((item, i) => (
            <div
              key={i}
              className="group flex items-center gap-4 p-4 rounded-xl bg-card/40 backdrop-blur-md border border-border/50 hover:border-accent/50 hover:bg-card/60 transition-all duration-300 hover:translate-x-2 animate-fade-in"
              style={{ animationDelay: `${0.3 + i * 0.1}s` }}
            >
              <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <item.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-6 animate-fade-in" style={{ animationDelay: "0.6s" }}>
        <div className="flex -space-x-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-background flex items-center justify-center text-xs font-bold text-primary-foreground"
            >
              {String.fromCharCode(64 + i)}
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center gap-1 text-accent">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="text-lg">★</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">4.9/5 from 12,000+ reviews</p>
        </div>
      </div>
    </div>
  );

  if (showForgotPassword) {
    return (
      <div className="min-h-screen relative overflow-hidden grid lg:grid-cols-2">
        <AnimatedBackground />
        <BrandPanel />
        <div className="relative z-10 flex items-center justify-center p-4 sm:p-8">
          <Card className="w-full max-w-md p-6 sm:p-10 bg-card/70 backdrop-blur-2xl border border-border/50 shadow-2xl shadow-primary/10 animate-scale-in">
            <div className="lg:hidden flex items-center justify-center mb-6">
              <img src={logo} alt="TradixoFX" className="h-14 w-auto object-contain" />
            </div>

            <div className="text-center mb-6">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent items-center justify-center mb-4 shadow-lg shadow-primary/30">
                <Lock className="h-7 w-7 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-black mb-2">Reset Password</h2>
              <p className="text-muted-foreground text-sm">
                Enter your email and we'll send you a secure reset link
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-sm font-semibold">
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-right text-primary-foreground font-bold shadow-lg shadow-primary/30 transition-all duration-500"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button variant="link" onClick={() => setShowForgotPassword(false)} className="text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Sign In
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden grid lg:grid-cols-2">
      <AnimatedBackground />
      <BrandPanel />

      <div className="relative z-10 flex items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md p-6 sm:p-8 bg-card/70 backdrop-blur-2xl border border-border/50 shadow-2xl shadow-primary/10 animate-scale-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-6">
            <img src={logo} alt="TradixoFX" className="h-14 w-auto object-contain" />
            <h1 className="text-xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mt-2">
              TradixoFX
            </h1>
          </div>

          <div className="text-center mb-6">
            <Badge className="bg-primary/10 text-primary border border-primary/30 mb-3 backdrop-blur-md">
              <TrendingUp className="h-3 w-3 mr-1" />
              Premium Access
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black mb-1">Welcome Back</h2>
            <p className="text-sm text-muted-foreground">Sign in or create your trading account</p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-muted/50 backdrop-blur-md p-1">
              <TabsTrigger
                value="signin"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-semibold transition-all"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-semibold transition-all"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="animate-fade-in">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-sm font-semibold">
                    Email / Mobile / Client ID
                  </Label>
                  <div className="relative group">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="identifier"
                      name="identifier"
                      type="text"
                      placeholder="Email, Mobile or CGF123456"
                      className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold">
                    Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="password"
                      name="password"
                      type={showSignInPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm p-0 h-auto text-primary hover:text-accent"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot Password?
                  </Button>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-right text-primary-foreground font-bold shadow-lg shadow-primary/30 transition-all duration-500 group"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                      Sign In to Account
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2 justify-center pt-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-accent" />
                  <span>Secured with 256-bit encryption</span>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="animate-fade-in">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold">Full Name</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                      required
                      minLength={2}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-sm font-semibold">Mobile Number</Label>
                  <div className="relative group">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      placeholder="+1 555 123 4567"
                      className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                      required
                      minLength={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-semibold">Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-semibold">Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="signup-password"
                      name="password"
                      type={showSignUpPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      className="pl-10 pr-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-right text-primary-foreground font-bold shadow-lg shadow-primary/30 transition-all duration-500 group"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                      Create Free Account
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center pt-2">
                  By signing up, you agree to our Terms & Privacy Policy
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center border-t border-border/50 pt-4">
            <Button variant="link" onClick={() => navigate("/")} className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
