import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Shield, TrendingUp, Wallet, LineChart, Globe, Award, CheckCircle, Users, Star, Lock, Zap, Bell, ArrowUp, ArrowDown, X, Newspaper, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarketNewsFeed } from "@/components/MarketNewsFeed";
import { TopMoversStrip } from "@/components/home/TopMoversStrip";
import { EconomicCalendar } from "@/components/home/EconomicCalendar";
import { TradingCalculator } from "@/components/home/TradingCalculator";
import { LiveSignals } from "@/components/home/LiveSignals";
import { TrustSecurity } from "@/components/home/TrustSecurity";
import { ComparisonTable } from "@/components/home/ComparisonTable";
import HeroTradingAnimation from "@/components/home/HeroTradingAnimation";


// Logo
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [recentActivities, setRecentActivities] = useState<Array<{
    id: number;
    type: string;
    user: string;
    amount: string;
    time: string;
  }>>([]);
  
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    user: string;
  }>({ show: false, message: "", user: "" });

  const [cryptoPrices, setCryptoPrices] = useState<{
    [key: string]: { price: number; change: number; previousPrice: number };
  }>({
    BTCUSDT: { price: 0, change: 0, previousPrice: 0 },
    ETHUSDT: { price: 0, change: 0, previousPrice: 0 },
    BNBUSDT: { price: 0, change: 0, previousPrice: 0 },
  });

  // Fake notification alerts
  useEffect(() => {
    const notifications = [
      { user: "James Carter", message: "just deposited $5,000" },
      { user: "Olivia Bennett", message: "just withdrew $12,500" },
      { user: "Ethan Walker", message: "opened a BTC position worth $8,200" },
      { user: "Sophia Reynolds", message: "made +$3,500 profit on ETH" },
      { user: "Mason Cooper", message: "just deposited $6,800" },
      { user: "Ava Mitchell", message: "just withdrew $9,200" },
      { user: "Noah Sullivan", message: "opened a Gold position worth $15,000" },
    ];

    const showNotification = () => {
      const randomNotification = notifications[Math.floor(Math.random() * notifications.length)];
      setNotification({ show: true, ...randomNotification });
      
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 4000);
    };

    showNotification();
    const interval = setInterval(showNotification, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch real-time crypto prices
  useEffect(() => {
    const basePricesRef = { current: {} as Record<string, number> };

    const fetchCryptoPrices = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-crypto-data');

        if (error) throw error;
        
        if (data?.cryptoData && Array.isArray(data.cryptoData)) {
          const targetCoins = ['BTC', 'ETH', 'BNB'];
          data.cryptoData
            .filter((coin: any) => targetCoins.includes(coin.symbol))
            .forEach((coin: any) => {
              const symbolKey = `${coin.symbol}USDT`;
              basePricesRef.current[symbolKey] = parseFloat(coin.price);
            });
        }
      } catch (error) {
        console.error('Error fetching crypto prices:', error);
      }
    };

    // Apply small momentum drift every 2 seconds for live feel
    const applyMomentum = () => {
      setCryptoPrices(prev => {
        const updated: typeof prev = {};
        for (const symbolKey of Object.keys(basePricesRef.current)) {
          const basePrice = basePricesRef.current[symbolKey];
          if (!basePrice) continue;
          const prevPrice = prev[symbolKey]?.price || basePrice;
          // Small drift: 0.01% - 0.05% in random direction
          const driftPercent = (Math.random() * 0.04 + 0.01) / 100;
          const direction = Math.random() > 0.5 ? 1 : -1;
          const newPrice = prevPrice + prevPrice * driftPercent * direction;
          updated[symbolKey] = {
            price: newPrice,
            change: newPrice - prevPrice,
            previousPrice: prevPrice,
          };
        }
        return Object.keys(updated).length > 0 ? updated : prev;
      });
    };

    fetchCryptoPrices().then(() => applyMomentum());
    // Refresh base prices every 60s, apply momentum every 2s
    const baseInterval = setInterval(fetchCryptoPrices, 60000);
    const momentumInterval = setInterval(applyMomentum, 2000);
    return () => {
      clearInterval(baseInterval);
      clearInterval(momentumInterval);
    };
  }, []);

  // Generate fake recent activities
  useEffect(() => {
    const activities = [
      { id: 1, type: "Deposit", user: "James Carter", amount: "$5,000", time: "2 mins ago" },
      { id: 2, type: "Withdrawal", user: "Olivia Bennett", amount: "$12,500", time: "5 mins ago" },
      { id: 3, type: "Deposit", user: "Ethan Walker", amount: "$8,200", time: "8 mins ago" },
      { id: 4, type: "Trade", user: "Sophia Reynolds", amount: "$15,000", time: "12 mins ago" },
      { id: 5, type: "Deposit", user: "Mason Cooper", amount: "$6,800", time: "15 mins ago" },
    ];
    setRecentActivities(activities);

    // Rotate activities every 5 seconds
    const interval = setInterval(() => {
      setRecentActivities(prev => {
        const newActivity = {
          id: Date.now(),
          type: ["Deposit", "Withdrawal", "Trade"][Math.floor(Math.random() * 3)],
          user: ["Liam Foster", "Ava Mitchell", "Noah Sullivan", "Isabella Hayes", "Lucas Brennan", "Mia Donovan", "Henry Whitaker"][Math.floor(Math.random() * 7)],
          amount: `$${(Math.random() * 20000 + 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
          time: "Just now"
        };
        return [newActivity, ...prev.slice(0, 4)];
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: TrendingUp,
      title: "Crypto Trading",
      description: "Trade Bitcoin, Ethereum, and 100+ cryptocurrencies with real-time data"
    },
    {
      icon: Globe,
      title: "Forex Markets",
      description: "Access major currency pairs with competitive spreads and instant execution"
    },
    {
      icon: LineChart,
      title: "Commodities",
      description: "Trade gold, silver, oil, and other commodities with professional tools"
    },
    {
      icon: Shield,
      title: "Secure Platform",
      description: "Bank-level security with KYC verification and encrypted transactions"
    },
    {
      icon: Wallet,
      title: "Digital Wallet",
      description: "Manage your funds securely with instant deposits and withdrawals"
    },
    {
      icon: Award,
      title: "Professional Tools",
      description: "Advanced charts, analytics, and trading indicators for better decisions"
    }
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-xl bg-background/80 sticky top-0 z-50 shadow-sm noise">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
              <img src={logo} alt="TradixoFX" className="h-14 w-auto sm:h-20 object-contain group-hover:scale-105 transition-all duration-300" />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" onClick={() => navigate("/auth")} className="hover:bg-primary/10 transition-all hidden sm:flex">
                Sign In
              </Button>
              <Button size="sm" className="bg-gradient-to-r from-primary via-primary/95 to-accent hover:shadow-lg hover:scale-105 transition-all duration-300 text-xs sm:text-sm px-3 sm:px-4 relative overflow-hidden group" onClick={() => navigate("/auth")}>
                <span className="relative z-10 flex items-center">
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Start</span>
                  <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Crypto Ticker */}
      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border/40 py-2 sm:py-4 overflow-hidden relative">
        <div className="absolute inset-0 shimmer opacity-50" />
        <div className="container mx-auto px-2 sm:px-4 relative">
          <div className="flex items-center justify-center gap-2 sm:gap-8 md:gap-16 overflow-x-auto scrollbar-hide">
            {Object.entries(cryptoPrices).map(([symbol, data]) => {
              const displayName = symbol.replace('USDT', '');
              const isUp = data.change > 0;
              const isDown = data.change < 0;
              
              const coinIcons: { [key: string]: string } = {
                'BTC': '₿',
                'ETH': 'Ξ',
                'BNB': 'B'
              };
              
              return (
                <div
                  key={symbol}
                  className={`flex items-center gap-1.5 sm:gap-3 p-1.5 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-500 flex-shrink-0 glass hover:scale-105 cursor-pointer ${
                    isUp ? 'glow-primary' : isDown ? 'border-red-500/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className={`h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shadow-lg text-sm sm:text-xl ${isUp || isDown ? 'animate-scale-pulse' : ''}`}>
                      {coinIcons[displayName] || displayName.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-bold text-xs sm:text-sm">{displayName}</p>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <p className={`font-black text-xs sm:text-lg transition-all duration-300 ${
                          isUp ? 'text-green-600' : isDown ? 'text-red-600' : ''
                        }`}>
                          ${data.price > 0 ? data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </p>
                        {isUp && <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 animate-bounce" />}
                        {isDown && <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 animate-bounce" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-24 md:py-40">
        {/* Animated Background with Floating Orbs */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
          
          {/* Animated Orbs */}
          <div className="absolute top-20 left-10 w-32 sm:w-72 h-32 sm:h-72 bg-primary/30 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-20 right-10 w-40 sm:w-96 h-40 sm:h-96 bg-accent/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[200px] sm:w-[500px] h-[200px] sm:h-[500px] bg-primary/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
          
          {/* Floating Particles */}
          <div className="particles">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="particle bg-primary/20"
                style={{
                  width: `${Math.random() * 10 + 5}px`,
                  height: `${Math.random() * 10 + 5}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${Math.random() * 10 + 5}s`,
                }}
              />
            ))}
          </div>
          
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />

          {/* Trading animation overlay */}
          <HeroTradingAnimation />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Floating Badge */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 glass rounded-full px-3 sm:px-6 py-1.5 sm:py-3 mb-4 sm:mb-8 shadow-lg animate-float border border-accent/30">
              <div className="relative">
                <Award className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                <div className="absolute inset-0 animate-ping">
                  <Award className="h-4 w-4 sm:h-5 sm:w-5 text-accent/50" />
                </div>
              </div>
              <span className="text-xs sm:text-sm font-bold gold-text uppercase tracking-wider">
                #1 Professional Trading Platform
              </span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
            
            <h1 className="text-3xl sm:text-6xl md:text-8xl font-black mb-4 sm:mb-8 leading-[1.05] tracking-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Trade With
              <span className="block relative mt-1 sm:mt-2">
                <span className="gold-text">
                  Confidence
                </span>
                {/* Underline glow */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-accent to-transparent rounded-full animate-pulse" />
              </span>
            </h1>
            
            <p className="text-sm sm:text-xl md:text-2xl text-muted-foreground mb-6 sm:mb-10 max-w-3xl mx-auto leading-relaxed animate-fade-in px-2" style={{ animationDelay: '0.2s' }}>
              Experience professional trading with advanced tools, lightning-fast execution, and institutional-grade security. Join <span className="font-bold text-primary">50,000+</span> successful traders.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-in px-4" style={{ animationDelay: '0.3s' }}>
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-gradient-to-r from-primary via-primary to-accent hover:shadow-2xl hover:scale-105 transition-all duration-300 text-sm sm:text-lg px-6 sm:px-10 py-4 sm:py-6 rounded-xl font-bold group relative overflow-hidden"
                onClick={() => navigate("/auth")}
              >
                <span className="relative z-10 flex items-center">
                  Start Trading Now 
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                </span>
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto text-sm sm:text-lg px-6 sm:px-10 py-4 sm:py-6 rounded-xl border-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 hover:scale-105 transition-all duration-300 backdrop-blur-sm group"
              >
                <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:animate-bounce" />
                View Live Markets
              </Button>
            </div>

            {/* Stats Pills with Animation */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 mt-8 sm:mt-16 animate-fade-in px-2" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full glass hover:scale-105 transition-all cursor-pointer group">
                <CheckCircle className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-green-500 group-hover:animate-bounce" />
                <span className="font-semibold text-xs sm:text-base">SSL Secured</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full glass hover:scale-105 transition-all cursor-pointer group">
                <Award className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-accent group-hover:animate-bounce" />
                <span className="font-semibold text-xs sm:text-base">ISO Certified</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full glass hover:scale-105 transition-all cursor-pointer group">
                <Users className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-primary group-hover:animate-bounce" />
                <span className="font-semibold text-xs sm:text-base">50K+ Users</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Crypto Markets */}
      <section className="py-10 sm:py-20 bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden noise">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-20 right-20 w-32 sm:w-64 h-32 sm:h-64 bg-primary/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-20 left-20 w-40 sm:w-80 h-40 sm:h-80 bg-accent/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
        
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="text-center mb-8 sm:mb-16">
            <Badge className="mb-4 sm:mb-6 glass text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold animate-bounce-in">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" /> Live Markets
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6 animate-fade-in">
              Real-Time Crypto <span className="gradient-text">Markets</span>
            </h2>
            <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in px-4" style={{ animationDelay: '0.1s' }}>
              Track live prices with instant updates every second
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 max-w-5xl mx-auto">
            {Object.entries(cryptoPrices).map(([symbol, data], index) => {
              const displayName = symbol.replace('USDT', '');
              const isUp = data.change > 0;
              const isDown = data.change < 0;
              
              const coinIcons: { [key: string]: string } = {
                'BTC': '₿',
                'ETH': 'Ξ',
                'BNB': 'B'
              };
              
              return (
                <Card
                  key={symbol}
                  className={`group p-4 sm:p-8 border-2 hover:shadow-2xl transition-all duration-500 rounded-xl sm:rounded-2xl backdrop-blur-sm card-hover animate-fade-in relative overflow-hidden ${
                    isUp 
                      ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30 hover:border-green-500/50' 
                      : isDown 
                      ? 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30 hover:border-red-500/50'
                      : 'bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/50'
                  }`}
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {/* Glow effect on hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                    isUp ? 'bg-green-500/5' : isDown ? 'bg-red-500/5' : 'bg-primary/5'
                  }`} />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3 sm:mb-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`h-10 w-10 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center font-black text-xl sm:text-3xl text-white shadow-xl group-hover:scale-110 transition-transform ${isUp || isDown ? 'animate-scale-pulse' : ''}`}>
                          {coinIcons[displayName] || displayName.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-lg sm:text-2xl font-black">{displayName}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">USDT</p>
                        </div>
                      </div>
                      <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all ${
                        isUp ? 'bg-green-500/20' : isDown ? 'bg-red-500/20' : 'bg-muted/20'
                      }`}>
                        {isUp && <ArrowUp className="h-5 w-5 sm:h-8 sm:w-8 text-green-600 animate-bounce" />}
                        {isDown && <ArrowDown className="h-5 w-5 sm:h-8 sm:w-8 text-red-600 animate-bounce" />}
                        {!isUp && !isDown && <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-muted-foreground" />}
                      </div>
                    </div>
                    
                    <div className="space-y-1 sm:space-y-2">
                      <p className={`text-2xl sm:text-4xl font-black transition-all duration-300 ${
                        isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-foreground'
                      }`}>
                        ${data.price > 0 ? data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                      </p>
                      <p className={`text-xs sm:text-sm font-semibold flex items-center gap-1 ${
                        isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-muted-foreground'
                      }`}>
                        {isUp && '+'}{data.change.toFixed(2)} USD
                        {isUp && ' 📈'}
                        {isDown && ' 📉'}
                      </p>
                    </div>

                    <Button 
                      size="sm"
                      className="w-full mt-4 sm:mt-6 bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all group-hover:scale-105 text-xs sm:text-sm relative overflow-hidden"
                      onClick={() => navigate("/auth")}
                    >
                      <span className="relative z-10 flex items-center justify-center">
                        Trade Now <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live Activity Feed */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6 sm:mb-12">
              <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold">
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-pulse" /> Real-Time Activity
              </Badge>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-4">
                Live Trading <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Activity</span>
              </h2>
              <p className="text-sm sm:text-xl text-muted-foreground px-2">Join thousands of traders making profitable trades</p>
            </div>
            
            <Card className="p-3 sm:p-8 border-2 border-primary/10 bg-card/80 backdrop-blur-xl shadow-2xl rounded-xl sm:rounded-2xl">
              <div className="space-y-2 sm:space-y-4">
                {recentActivities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-2.5 sm:p-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 hover:from-primary/5 hover:to-accent/5 transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-lg animate-in fade-in slide-in-from-top-2"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center gap-2 sm:gap-4">
                      <Avatar className="h-8 w-8 sm:h-12 sm:w-12 ring-2 ring-primary/20">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.user}`} alt={activity.user} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-xs sm:text-lg">
                          {activity.user.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm sm:text-lg">{activity.user}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          {activity.type === "Deposit" && <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500" />}
                          {activity.type === "Withdrawal" && <Wallet className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-500" />}
                          {activity.type === "Trade" && <LineChart className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-purple-500" />}
                          {activity.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm sm:text-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500 bg-clip-text text-transparent">
                        {activity.amount}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live updates every 5 seconds
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Live Market News Section */}
      <section className="py-10 sm:py-20 bg-gradient-to-br from-background via-primary/5 to-accent/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="text-center mb-8 sm:mb-12">
            <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold animate-bounce-in">
              <Newspaper className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-pulse" /> Live Feed
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6 animate-fade-in">
              Global Market <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">News</span>
            </h2>
            <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in px-2" style={{ animationDelay: '0.1s' }}>
              Real-time news on Crypto, Forex, and Commodities — auto-updates every 5 minutes
            </p>
          </div>

          <div className="max-w-7xl mx-auto">
            <MarketNewsFeed variant="landing" defaultCategory="all" limit={9} />
          </div>
        </div>
      </section>

      {/* Top Movers Strip */}
      <TopMoversStrip />

      {/* Economic Calendar */}
      <EconomicCalendar />

      {/* Trading Calculator */}
      <TradingCalculator />

      {/* Features Grid */}
      <section className="py-12 sm:py-24 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6">
              Why Choose <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">TradixoFX?</span>
            </h2>
            <p className="text-sm sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto px-2">
              Professional-grade tools trusted by thousands of successful traders worldwide
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group relative p-3 sm:p-8 hover:shadow-2xl transition-all duration-500 border border-primary/40 hover:border-white/40 bg-primary text-white rounded-xl sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4 hover:-translate-y-1 overflow-hidden"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Index number watermark */}
                <span className="absolute top-2 right-3 sm:top-4 sm:right-5 text-3xl sm:text-6xl font-black text-white/10 group-hover:text-white/20 transition-colors leading-none select-none">
                  0{index + 1}
                </span>
                <div className="relative h-10 w-10 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-white/15 flex items-center justify-center mb-3 sm:mb-6 group-hover:scale-110 transition-all duration-300 ring-1 ring-white/20">
                  <feature.icon className="h-5 w-5 sm:h-8 sm:w-8 text-white transition-colors" />
                </div>
                <h3 className="text-sm sm:text-2xl font-bold mb-1 sm:mb-3 text-white relative z-10">{feature.title}</h3>
                <p className="text-xs sm:text-base text-white/80 leading-relaxed line-clamp-3 sm:line-clamp-none relative z-10">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Live Trading Signals */}
      <LiveSignals />

      {/* Comparison Table */}
      <ComparisonTable />

      {/* Trust & Security */}
      <TrustSecurity />

      {/* Testimonials */}
      <section className="py-12 sm:py-24 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="text-center mb-8 sm:mb-16">
            <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold">
              <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 fill-primary" /> Testimonials
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6">
              What Our <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Traders</span> Say
            </h2>
            <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              Join thousands of satisfied traders who trust TradixoFX
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 max-w-7xl mx-auto">
            {[
              {
                name: "Michael Chen",
                role: "Day Trader",
                content: "Best trading platform I've used. The real-time data and execution speed are unmatched. Made over $50K in profits last quarter.",
                rating: 5
              },
              {
                name: "Sarah Williams",
                role: "Crypto Investor",
                content: "TradixoFX's security features give me peace of mind. The withdrawal process is smooth and customer support is excellent.",
                rating: 5
              },
              {
                name: "David Kumar",
                role: "Forex Trader",
                content: "Professional-grade tools at my fingertips. The leverage options and low spreads make this my go-to platform for forex trading.",
                rating: 5
              }
            ].map((testimonial, index) => (
              <Card 
                key={index} 
                className="group p-4 sm:p-8 border-2 border-border/50 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm rounded-xl sm:rounded-2xl hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="flex mb-3 sm:mb-6 gap-0.5 sm:gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 sm:h-6 sm:w-6 fill-accent text-accent animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <p className="text-xs sm:text-lg text-muted-foreground mb-4 sm:mb-6 italic leading-relaxed line-clamp-4 sm:line-clamp-none">"{testimonial.content}"</p>
                <div className="flex items-center gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-border/50">
                  <Avatar className="h-10 w-10 sm:h-14 sm:w-14 ring-2 ring-primary/20">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${testimonial.name}`} alt={testimonial.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-sm sm:text-xl">
                      {testimonial.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-sm sm:text-lg">{testimonial.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {/* Trusted Worldwide section hidden */}

      {/* CTA Section */}
      <section className="py-14 sm:py-28 bg-primary relative overflow-hidden">
        {/* Subtle matte texture */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.07]" />
        {/* Top & bottom accent rules */}
        <div className="absolute top-0 left-0 right-0 h-px bg-white/15" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/15" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-5 sm:mb-7 bg-white text-primary border-0 px-4 py-2 text-xs sm:text-sm font-bold shadow-lg uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 text-primary" /> Limited Time Offer
            </Badge>
            <h2 className="text-3xl sm:text-5xl md:text-7xl font-black mb-5 sm:mb-8 leading-[1.05] tracking-tight text-white">
              Ready to Start
              <span className="block mt-2 sm:mt-3 text-white">
                <span className="relative inline-block">
                  Trading?
                  <span className="absolute left-0 right-0 -bottom-1 sm:-bottom-2 h-1 sm:h-1.5 bg-white/80 rounded-full" />
                </span>
              </span>
            </h2>
            <p className="text-base sm:text-xl md:text-2xl mb-7 sm:mb-12 text-white/90 leading-relaxed max-w-2xl mx-auto px-2">
              Join 50,000+ successful traders who trust TradixoFX. Start with a free account today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-white text-primary hover:bg-white/95 text-sm sm:text-xl px-6 sm:px-12 py-4 sm:py-7 rounded-xl font-bold shadow-xl hover:scale-[1.03] transition-all duration-300 group"
                onClick={() => navigate("/auth")}
              >
                Create Free Account 
                <ArrowRight className="ml-2 h-4 w-4 sm:h-6 sm:w-6 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto text-sm sm:text-xl px-6 sm:px-12 py-4 sm:py-7 rounded-xl border-2 border-white/70 bg-transparent text-white hover:bg-white hover:text-primary font-semibold transition-all duration-300"
              >
                <Shield className="mr-2 h-4 w-4 sm:h-6 sm:w-6" />
                Learn About Security
              </Button>
            </div>
            <p className="mt-5 sm:mt-8 text-xs sm:text-base text-white/90 flex items-center justify-center gap-2 font-medium">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> No credit card required • Start in 2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="py-12 sm:py-24 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 sm:mb-16">
              <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" /> FAQs
              </Badge>
              <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-6">
                Frequently Asked <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Questions</span>
              </h2>
              <p className="text-sm sm:text-xl text-muted-foreground px-2">
                Everything you need to know about trading with TradixoFX
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-2 sm:space-y-4">
              <AccordionItem 
                value="item-1" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  How do I get started with TradixoFX?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  Getting started is simple! Click "Get Started" to create your free account. Complete the KYC verification process, 
                  deposit funds using UPI or Net Banking, and you're ready to start trading crypto, forex, and commodities.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-2" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  What are the deposit and withdrawal methods?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  We support multiple payment methods including USD bank wire transfers, ACH, debit/credit cards, and major crypto deposits. 
                  Deposits are typically processed instantly, while withdrawals are processed within 24-48 hours after broker approval for security purposes.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-3" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  Is my money safe on TradixoFX?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  Absolutely! We use bank-level SSL encryption, secure cold storage for crypto assets, and implement strict KYC/AML 
                  policies. All funds are segregated and your data is protected with industry-leading security measures.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-4" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  What is leverage trading and how does it work?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  Leverage allows you to control larger positions with smaller capital. TradixoFX offers leverage up to 100x on 
                  select markets. For example, with 10x leverage and $100, you can open a $1,000 position. However, leverage 
                  amplifies both gains and losses, so trade responsibly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-5" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  Are there any trading fees?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  TradixoFX operates on a transparent fee structure. We charge competitive spreads on trades with no hidden fees. 
                  There are no deposit fees, and withdrawal fees vary by payment method. Check our fee schedule in your account 
                  settings for detailed information.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem 
                value="item-6" 
                className="border-2 border-border/50 rounded-xl sm:rounded-2xl px-3 sm:px-6 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-lg font-bold hover:text-primary">
                  Can I trade on mobile?
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-base text-muted-foreground leading-relaxed">
                  Yes! TradixoFX is fully optimized for mobile devices. Access all trading features, manage positions, and monitor 
                  markets from anywhere using your mobile browser. Our responsive design ensures a seamless trading experience 
                  on any device.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border/40 bg-gradient-to-b from-muted/40 via-background to-muted/30 pt-12 sm:pt-20 pb-6 sm:pb-8 overflow-hidden">
        {/* Top gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-3 sm:px-4 relative">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
              {/* Brand */}
              <div className="flex flex-col items-center md:items-start gap-3 sm:col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 sm:gap-3">
                  <img src={logo} alt="TradixoFX" className="h-14 w-14 sm:h-16 sm:w-16 object-contain" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground text-center md:text-left leading-relaxed max-w-xs">
                  Your trusted platform for crypto, forex & commodities trading. Built for professionals, accessible for everyone.
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] sm:text-xs border-accent/40 text-accent bg-accent/5">
                    <Shield className="h-3 w-3 mr-1" /> SSL Secured
                  </Badge>
                  <Badge variant="outline" className="text-[10px] sm:text-xs border-primary/40 text-primary bg-primary/5">
                    <Award className="h-3 w-3 mr-1" /> ISO Certified
                  </Badge>
                </div>
              </div>

              {/* Contact */}
              <div className="flex flex-col items-center md:items-start gap-3">
                <h4 className="text-sm sm:text-base font-bold text-foreground tracking-wide uppercase">Contact</h4>
                <div className="text-xs sm:text-sm text-muted-foreground text-center md:text-left space-y-2">
                  <p className="flex items-start gap-2 justify-center md:justify-start">
                    <Globe className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                    <span>
                      1209 Orange Street<br />
                      Wilmington, DE 19801<br />
                      United States
                    </span>
                  </p>
                  <p>
                    <a href="tel:+13025550199" className="hover:text-primary transition-colors font-semibold inline-flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-accent" />
                      +1 (302) 555-0199
                    </a>
                  </p>
                  <p>
                    <a href="mailto:support@tradixofx.com" className="hover:text-primary transition-colors inline-flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-accent" />
                      support@tradixofx.com
                    </a>
                  </p>
                </div>
              </div>

              {/* Markets */}
              <div className="flex flex-col items-center md:items-start gap-3">
                <h4 className="text-sm sm:text-base font-bold text-foreground tracking-wide uppercase">Markets</h4>
                <div className="flex flex-col items-center md:items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                  <a href="#" className="hover:text-accent transition-colors story-link">Cryptocurrency</a>
                  <a href="#" className="hover:text-accent transition-colors story-link">Forex Trading</a>
                  <a href="#" className="hover:text-accent transition-colors story-link">Commodities</a>
                  <a href="#" className="hover:text-accent transition-colors story-link">Indices</a>
                </div>
              </div>

              {/* Quick Links */}
              <div className="flex flex-col items-center md:items-start gap-3">
                <h4 className="text-sm sm:text-base font-bold text-foreground tracking-wide uppercase">Company</h4>
                <div className="flex flex-col items-center md:items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                  <a href="#" className="hover:text-accent transition-colors story-link">About Us</a>
                  <a href="#" className="hover:text-accent transition-colors story-link">Privacy Policy</a>
                  <a href="#" className="hover:text-accent transition-colors story-link">Terms of Service</a>
                  <a href="#" className="hover:text-accent transition-colors story-link">Support Center</a>
                </div>
              </div>
            </div>

            <div className="divider-gold mt-10 sm:mt-14" />

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <p className="text-xs sm:text-sm text-muted-foreground">
                © 2024 <span className="font-bold text-foreground">TradixoFX</span>. All rights reserved.
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground/80 max-w-md">
                Trading involves substantial risk and may result in loss of capital. Trade responsibly.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
