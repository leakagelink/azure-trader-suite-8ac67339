import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Award, FileCheck, Banknote, UserCheck, Server, HeadphonesIcon } from "lucide-react";

const trustItems = [
  {
    icon: Shield,
    title: "256-bit SSL Encryption",
    description: "Bank-grade encryption protects every transaction & data exchange",
  },
  {
    icon: Banknote,
    title: "Segregated Client Funds",
    description: "Your capital is held in separate accounts, never mixed with company funds",
  },
  {
    icon: FileCheck,
    title: "KYC & AML Compliant",
    description: "Full regulatory compliance with international AML & KYC standards",
  },
  {
    icon: Lock,
    title: "Two-Factor Authentication",
    description: "Extra security layer with 2FA on all withdrawals & sensitive actions",
  },
  {
    icon: Server,
    title: "99.9% Uptime SLA",
    description: "Enterprise-grade infrastructure with redundant servers worldwide",
  },
  {
    icon: UserCheck,
    title: "Verified Brokerage",
    description: "Licensed broker with transparent operations & audited financials",
  },
  {
    icon: Award,
    title: "Award-Winning Platform",
    description: "Recognized by industry leaders for innovation & user experience",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Live Support",
    description: "Dedicated account managers and round-the-clock customer service",
  },
];

export const TrustSecurity = () => {
  return (
    <section className="py-12 sm:py-20 relative bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 sm:mb-14">
          <Badge variant="outline" className="mb-3 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/30">
            <Shield className="h-3 w-3 mr-1" /> Trust & Security
          </Badge>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3">
            Your Security is Our <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Top Priority</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Trade with confidence on a platform built with institutional-grade security
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto">
          {trustItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <Card
                key={i}
                className="p-5 sm:p-6 bg-card/60 backdrop-blur border-border/40 hover:border-primary/40 transition-all hover:scale-[1.03] hover:shadow-xl group"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </Card>
            );
          })}
        </div>

        {/* Trust badges row */}
        <div className="mt-10 sm:mt-14 flex flex-wrap items-center justify-center gap-6 sm:gap-10 opacity-70">
          {["SSL Secured", "PCI DSS", "GDPR", "ISO 27001", "AML Verified"].map((badge) => (
            <div key={badge} className="flex items-center gap-2">
              <Award className="h-4 w-4 text-accent" />
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider">{badge}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
