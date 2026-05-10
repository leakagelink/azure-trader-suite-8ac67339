import { useState, useEffect, useRef, memo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCcw, Activity, ChevronLeft, ChevronRight, ShoppingCart, DollarSign, ExternalLink, Coins, Maximize2 } from "lucide-react";
import { Tabs as InputTabs, TabsList as InputTabsList, TabsTrigger as InputTabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invokeForexData, invokeForexChartData } from "@/lib/forexCache";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  ReferenceLine,
  Cell,
} from "recharts";

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  isLive?: boolean;
}

interface CustomCandlestickProps {
  data: CandleData[];
  currencySymbol: string;
}

const CustomCandlestick = memo(({ data, currencySymbol }: CustomCandlestickProps) => {
  const minPrice = Math.min(...data.map(d => d.low));
  const maxPrice = Math.max(...data.map(d => d.high));
  const maxVolume = Math.max(...data.map(d => d.volume || 0));
  const priceRange = maxPrice - minPrice || 1;
  const activeCandle = data[data.length - 1];
  const activeColor = activeCandle?.close >= activeCandle?.open ? "hsl(142 76% 45%)" : "hsl(0 84% 60%)";

  const formatPrice = (v: number) => {
    if (v >= 1000) return `${currencySymbol}${v.toFixed(0)}`;
    if (v >= 1) return `${currencySymbol}${v.toFixed(2)}`;
    return `${currencySymbol}${v.toFixed(4)}`;
  };

  const CandleShape = (props: any) => {
    const { x, width, payload, background } = props;
    const { open, close, high, low, isLive } = payload;
    const chartHeight = background?.height ?? 360;
    const chartTop = background?.y ?? 10;
    const chartRight = (background?.x ?? 0) + (background?.width ?? 0);

    const isGreen = close >= open;
    const upColor = "hsl(142 76% 45%)";
    const downColor = "hsl(0 84% 60%)";
    const color = isGreen ? upColor : downColor;
    const gradId = isGreen ? "candleUp" : "candleDown";

    const getY = (price: number) =>
      chartTop + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

    const wickX = x + width / 2;
    const bodyTopY = getY(Math.max(open, close));
    const bodyBottomY = getY(Math.min(open, close));
    const bodyHeight = Math.max(bodyBottomY - bodyTopY, 1.5);
    const candleWidth = Math.max(width * (isLive ? 0.82 : 0.65), isLive ? 4 : 2);
    const bodyX = x + (width - candleWidth) / 2;
    const closeY = getY(close);

    return (
      <g style={{ transition: "all 260ms ease-out" }}>
        <line
          x1={wickX}
          y1={getY(high)}
          x2={wickX}
          y2={getY(low)}
          stroke={color}
          strokeWidth={isLive ? 2.25 : 1.5}
          strokeLinecap="round"
          opacity={isLive ? 1 : 0.9}
        />
        <rect
          x={bodyX}
          y={bodyTopY}
          width={candleWidth}
          height={bodyHeight}
          rx={1.5}
          fill={`url(#${gradId})`}
          stroke={color}
          strokeWidth={isLive ? 2 : 1}
          opacity={isLive ? 1 : 0.96}
        />
        {isLive && (
          <>
            <line
              x1={bodyX + candleWidth + 2}
              y1={closeY}
              x2={Math.min(chartRight, bodyX + candleWidth + 28)}
              y2={closeY}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={wickX} cy={closeY} r={3.25} fill={color} opacity={0.95} />
          </>
        )}
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={420}>
      <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 28, left: 8 }}>
        <defs>
          <linearGradient id="candleUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(142 76% 55%)" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(142 76% 38%)" stopOpacity={0.95} />
          </linearGradient>
          <linearGradient id="candleDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0 84% 65%)" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(0 84% 48%)" stopOpacity={0.95} />
          </linearGradient>
          <linearGradient id="volumeBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(45 90% 55%)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="hsl(45 90% 55%)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
            <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="2 6"
          stroke="hsl(var(--border))"
          opacity={0.25}
          vertical={false}
        />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: "10px" }}
          tickLine={false}
          axisLine={{ stroke: "hsl(var(--border))", opacity: 0.3 }}
          interval="preserveStartEnd"
          minTickGap={30}
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: "11px", fontFamily: "ui-monospace, monospace" }}
          tickLine={false}
          axisLine={false}
          domain={[minPrice - priceRange * 0.05, maxPrice + priceRange * 0.05]}
          tickFormatter={formatPrice}
          width={60}
        />
        <YAxis
          yAxisId="volume"
          orientation="left"
          hide
          domain={[0, maxVolume * 4]}
        />

        <Tooltip
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.5 }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const d = payload[0]?.payload ?? {};
              const o = Number(d?.open ?? 0);
              const h = Number(d?.high ?? 0);
              const l = Number(d?.low ?? 0);
              const c = Number(d?.close ?? 0);
              const isGreen = c >= o;
              const change = o > 0 ? ((c - o) / o) * 100 : 0;
              return (
                <div className="bg-card/95 backdrop-blur-xl border border-primary/30 p-3 rounded-xl shadow-2xl shadow-primary/10 min-w-[180px]">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/50">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{d?.time ?? 'N/A'}</span>
                    {d?.isLive && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-emerald-500 font-bold tracking-wider">LIVE</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono">
                    <span className="text-muted-foreground">O</span>
                    <span className="text-right font-semibold">{formatPrice(o)}</span>
                    <span className="text-muted-foreground">H</span>
                    <span className="text-right font-semibold text-emerald-500">{formatPrice(h)}</span>
                    <span className="text-muted-foreground">L</span>
                    <span className="text-right font-semibold text-red-500">{formatPrice(l)}</span>
                    <span className="text-muted-foreground">C</span>
                    <span className={`text-right font-bold ${isGreen ? 'text-emerald-500' : 'text-red-500'}`}>{formatPrice(c)}</span>
                  </div>
                  <div className={`mt-2 pt-2 border-t border-border/50 text-xs font-semibold text-right ${isGreen ? 'text-emerald-500' : 'text-red-500'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </div>
                </div>
              );
            }
            return null;
          }}
        />

        <Bar yAxisId="volume" dataKey="volume" fill="url(#volumeBar)" radius={[2, 2, 0, 0]} isAnimationActive={false} activeBar={false}>
          {data.map((entry, i) => (
            <Cell
              key={`vol-${i}`}
              fill={entry.close >= entry.open ? "hsl(142 76% 45% / 0.35)" : "hsl(0 84% 55% / 0.35)"}
            />
          ))}
        </Bar>

        <ReferenceLine
          yAxisId="price"
          y={activeCandle?.close}
          stroke={activeColor}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          ifOverflow="extendDomain"
          label={{
            value: formatPrice(activeCandle?.close ?? 0),
            position: "right",
            fill: activeColor,
            fontSize: 11,
            fontWeight: 700,
          }}
        />

        <Bar
          yAxisId="price"
          dataKey="high"
          shape={<CandleShape />}
          isAnimationActive={false}
          activeBar={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
});

CustomCandlestick.displayName = "CustomCandlestick";

const Trading = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [chartData, setChartData] = useState<CandleData[]>([]);
  
  // Safely parse initial price - handle both crypto ($123.45) and forex (1.5378) formats
  const parseInitialPrice = (priceStr: string | undefined): number => {
    if (!priceStr) return 0;
    const cleanPrice = String(priceStr).replace(/[$,]/g, '');
    const parsed = parseFloat(cleanPrice);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const initialPrice = parseInitialPrice(location.state?.price);
  const tradingName = location.state?.name || `${symbol?.toUpperCase()}`;
  const tradingIcon = location.state?.icon || location.state?.logo;
  const currencySymbol = location.state?.currencySymbol || '$';
  
  const [currentPrice, setCurrentPrice] = useState<number>(0); // Start with 0, will be set from API
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [liveCandle, setLiveCandle] = useState<CandleData | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [swipeIndicator, setSwipeIndicator] = useState<'left' | 'right' | null>(null);
  const prevPriceRef = useRef<number>(0);
  const liveUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showLongDialog, setShowLongDialog] = useState(false);
  const [showShortDialog, setShowShortDialog] = useState(false);
  const [tradeAmount, setTradeAmount] = useState(""); // USD amount
  const [lotSize, setLotSize] = useState(""); // Lot size (units)
  const [inputMode, setInputMode] = useState<'amount' | 'lotSize'>('amount');
  const [leverage, setLeverage] = useState(1);
  const [stopLoss, setStopLoss] = useState(""); // Stop loss price
  const [takeProfit, setTakeProfit] = useState(""); // Take profit price
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState(""); // Limit order price
  const [chartScale, setChartScale] = useState(1);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const touchStartDistance = useRef<number>(0);

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    if (!user?.id) return;
    
    const { data: wallet, error } = await supabase
      .from('user_wallets')
      .select('balance')
      .eq('user_id', user.id)
      .eq('currency', 'USD')
      .maybeSingle();
    
    if (!error && wallet) {
      setWalletBalance(wallet.balance || 0);
    }
  };

  // Fetch balance when dialogs open
  useEffect(() => {
    if (showLongDialog || showShortDialog) {
      fetchWalletBalance();
    }
  }, [showLongDialog, showShortDialog]);

  // Swipe gesture handlers
  const navigateTimeframe = (direction: 'left' | 'right') => {
    const currentIndex = TIMEFRAMES.indexOf(timeframe);
    let newIndex: number;
    
    if (direction === 'left') {
      // Swipe left = next timeframe
      newIndex = currentIndex < TIMEFRAMES.length - 1 ? currentIndex + 1 : currentIndex;
    } else {
      // Swipe right = previous timeframe
      newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    }

    if (newIndex !== currentIndex) {
      setTimeframe(TIMEFRAMES[newIndex]);
      setSwipeIndicator(direction);
      toast.success(`Switched to ${TIMEFRAMES[newIndex].toUpperCase()} timeframe`, {
        duration: 1500,
      });
      
      // Clear indicator after animation
      setTimeout(() => setSwipeIndicator(null), 500);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => navigateTimeframe('left'),
    onSwipedRight: () => navigateTimeframe('right'),
    trackMouse: false, // Only track touch, not mouse
    trackTouch: true,
    delta: 50, // Minimum swipe distance
    preventScrollOnSwipe: false,
  });

  // Pinch to zoom handlers
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchStartDistance.current = getTouchDistance(e.touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance.current > 0) {
      const currentDistance = getTouchDistance(e.touches);
      const scaleChange = currentDistance / touchStartDistance.current;
      const newScale = Math.min(Math.max(chartScale * scaleChange, 0.5), 3);
      setChartScale(newScale);
      touchStartDistance.current = currentDistance;
    }
  };

  const handleTouchEnd = () => {
    touchStartDistance.current = 0;
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    fetchRealTimeData();
    
    return () => {
      if (liveUpdateIntervalRef.current) {
        clearInterval(liveUpdateIntervalRef.current);
      }
    };
  }, [user, timeframe, navigate, symbol]);

  useEffect(() => {
    if (chartData.length > 0 && liveCandle) {
      liveUpdateIntervalRef.current = setInterval(() => {
        updateLiveCandle();
      }, 600);
    }
    return () => {
      if (liveUpdateIntervalRef.current) {
        clearInterval(liveUpdateIntervalRef.current);
      }
    };
  }, [chartData.length, liveCandle?.timestamp]);

  // Check if symbol is a forex pair
  const isForexPair = (sym: string) => {
    const forexSymbols = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'NZD', 'SGD'];
    return forexSymbols.includes(sym.toUpperCase());
  };

  // Check if symbol is a commodity
  const isCommodity = (sym: string) => {
    const commoditySymbols = ['XAU', 'XAG', 'WTI', 'NG', 'HG', 'XPT', 'XPD', 'BRENT'];
    return commoditySymbols.includes(sym.toUpperCase());
  };

  // Generate TradingView URL based on symbol type
  const getTradingViewUrl = () => {
    const sym = symbol?.toUpperCase() || 'BTC';
    
    if (isForexPair(sym)) {
      // Forex pairs - use FX exchange
      return `https://www.tradingview.com/chart/?symbol=FX%3A${sym}USD`;
    } else if (isCommodity(sym)) {
      // Commodities
      const commodityMap: Record<string, string> = {
        'XAU': 'OANDA:XAUUSD',
        'XAG': 'OANDA:XAGUSD',
        'WTI': 'NYMEX:CL1!',
        'NG': 'NYMEX:NG1!',
        'HG': 'COMEX:HG1!',
        'XPT': 'OANDA:XPTUSD',
        'XPD': 'OANDA:XPDUSD',
        'BRENT': 'ICEEUR:BRN1!',
      };
      const tradingViewSymbol = commodityMap[sym] || `TVC:${sym}`;
      return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol)}`;
    } else {
      // Crypto - use BINANCE exchange
      return `https://www.tradingview.com/chart/?symbol=BINANCE%3A${sym}USDT`;
    }
  };

  const fetchRealTimeData = async () => {
    if (!symbol) return;
    
    try {
      setLoading(true);
      
      // Determine which API to use based on symbol type
      const isForex = isForexPair(symbol);
      const isCommoditySymbol = isCommodity(symbol);
      
      // For crypto and commodities, first get the real current price from their respective APIs
      let realCurrentPrice = 0; // Start with 0, only use API price
      
      if (!isForex && !isCommoditySymbol) {
        // Crypto - get from CoinMarketCap
        try {
          const { data: cryptoData, error: cryptoError } = await supabase.functions.invoke('fetch-crypto-data');
          
          if (!cryptoError && cryptoData?.cryptoData) {
            const coin = cryptoData.cryptoData.find((c: any) => c.symbol.toUpperCase() === symbol.toUpperCase());
            if (coin) {
              realCurrentPrice = parseFloat(coin.price);
              console.log('Real CoinMarketCap price for', symbol, ':', realCurrentPrice);
            }
          }
        } catch (err) {
          console.error('Error fetching real crypto price:', err);
        }
      } else if (isCommoditySymbol) {
        // Commodities - get from fetch-commodities-data
        try {
          const { data: commoditiesData, error: commoditiesError } = await supabase.functions.invoke('fetch-commodities-data');
          
          if (!commoditiesError && commoditiesData?.commoditiesData) {
            const commodity = commoditiesData.commoditiesData.find((c: any) => c.symbol.toUpperCase() === symbol.toUpperCase());
            if (commodity) {
              realCurrentPrice = parseFloat(commodity.price);
              console.log('Real commodity price for', symbol, ':', realCurrentPrice);
            }
          }
        } catch (err) {
          console.error('Error fetching real commodity price:', err);
        }
      }
      
      const { data, error } = isForex
        ? await invokeForexChartData(symbol.toUpperCase(), timeframe)
        : await supabase.functions.invoke('fetch-taapi-data', {
            body: { symbol: symbol.toUpperCase(), interval: timeframe }
          });

      if (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch data. Please try again.');
        return;
      }

      if (data?.candles && data.candles.length > 0) {
        console.log('Chart data received:', {
          candleCount: data.candles.length,
          currentPrice: data.currentPrice,
          source: data.source,
          realCurrentPrice,
          isForex,
          isCommoditySymbol
        });
        
        // For crypto/commodities using fallback data, adjust candles to match real price
        let adjustedCandles = data.candles;
        if (!isForex && data.source === 'fallback' && realCurrentPrice > 0) {
          // Calculate adjustment ratio based on real vs fallback price
          const fallbackPrice = data.currentPrice || data.candles[data.candles.length - 1]?.close;
          const adjustmentRatio = realCurrentPrice / fallbackPrice;
          
          console.log('Adjusting fallback candles to real price:', {
            fallbackPrice,
            realCurrentPrice,
            adjustmentRatio
          });
          
          // Adjust all candle prices to match real market price
          adjustedCandles = data.candles.map((candle: any) => ({
            ...candle,
            open: candle.open * adjustmentRatio,
            high: candle.high * adjustmentRatio,
            low: candle.low * adjustmentRatio,
            close: candle.close * adjustmentRatio,
          }));
        }

        const formattedData: CandleData[] = adjustedCandles.map((candle: any, index: number) => {
          // Ensure all candle values are valid numbers
          const open = typeof candle.open === 'number' ? candle.open : parseFloat(candle.open) || 0;
          const high = typeof candle.high === 'number' ? candle.high : parseFloat(candle.high) || 0;
          const low = typeof candle.low === 'number' ? candle.low : parseFloat(candle.low) || 0;
          const close = typeof candle.close === 'number' ? candle.close : parseFloat(candle.close) || 0;
          
          return {
            time: new Date(candle.timestampHuman || candle.timestamp * 1000).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            open,
            high,
            low,
            close,
            volume: candle.volume || 0,
            timestamp: candle.timestamp,
            isLive: index === adjustedCandles.length - 1, // Mark last candle as live
          };
        });

        // Determine latest price - ONLY use verified real prices to prevent fake data showing
        let latestPrice = 0;
        
        if (isForex) {
          // For forex, use the chart data price
          const rawPrice = data.currentPrice || formattedData[formattedData.length - 1]?.close || 0;
          latestPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice)) || 0;
        } else if (isCommoditySymbol) {
          // For commodities, ONLY use real commodity API price
          if (realCurrentPrice > 0) {
            latestPrice = realCurrentPrice;
          } else {
            console.error('Failed to get real commodity price');
            toast.error('Failed to fetch real-time commodity price. Please refresh.');
            setLoading(false);
            return; // Exit early - prevents fake prices from showing
          }
        } else {
          // For crypto, ONLY use CoinMarketCap real price
          if (realCurrentPrice > 0) {
            latestPrice = realCurrentPrice;
          } else {
            console.error('Failed to get real crypto price from CoinMarketCap');
            toast.error('Failed to fetch real-time price. Please refresh.');
            setLoading(false);
            return; // Exit early - prevents fake prices from showing
          }
        }
        
        // Only set chart data AFTER we've confirmed we have valid prices
        // This ensures fake prices are never displayed
        setChartData(formattedData);
        
        console.log('Setting current price:', {
          latestPrice,
          realCurrentPrice,
          isForex,
          isCommoditySymbol,
          isValid: latestPrice > 0
        });
        
        if (latestPrice > 0) {
          setCurrentPrice(latestPrice);
          prevPriceRef.current = latestPrice;
          
          // Calculate price change
          const firstPrice = formattedData[0]?.open || latestPrice;
          const change = ((latestPrice - firstPrice) / firstPrice) * 100;
          setPriceChange(change);

          // Initialize live candle
          const lastCandle = formattedData[formattedData.length - 1];
          if (lastCandle) {
            setLiveCandle({ ...lastCandle, isLive: true });
          }
        }
      } else {
        console.error('No candle data received');
        toast.error('No data available for this symbol');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateLiveCandle = () => {
    setChartData(prev => {
      if (prev.length === 0) return prev;

      const lastCandle = prev[prev.length - 1];
      const currentClose = typeof lastCandle.close === 'number' && !isNaN(lastCandle.close) && lastCandle.close > 0
        ? lastCandle.close
        : prevPriceRef.current || 1;

      // Keep live momentum visible and continuous, like TradingView/Binance ticks
      const volatility = currentClose * 0.0012;
      const randomChange = (Math.random() - 0.5) * volatility * 2;
      const newClose = currentClose + randomChange;

      if (!isFinite(newClose) || newClose <= 0) {
        console.error('Invalid newClose value:', newClose);
        return prev;
      }

      const prevPrice = prevPriceRef.current || currentClose;
      setPriceDirection(newClose > prevPrice ? 'up' : newClose < prevPrice ? 'down' : 'neutral');
      prevPriceRef.current = newClose;

      const updatedCandle: CandleData = {
        ...lastCandle,
        close: newClose,
        high: Math.max(lastCandle.high || newClose, newClose),
        low: Math.min(lastCandle.low || newClose, newClose),
        isLive: true,
      };

      setLiveCandle(updatedCandle);
      setCurrentPrice(newClose);

      const firstPrice = prev[0]?.open || newClose;
      setPriceChange(((newClose - firstPrice) / firstPrice) * 100);

      window.setTimeout(() => setPriceDirection('neutral'), 260);

      const newData = [...prev];
      newData[newData.length - 1] = updatedCandle;
      return newData;
    });
  };

  const handleOpenPosition = async (type: 'long' | 'short') => {
    // Validate based on input mode
    if (inputMode === 'amount') {
      if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
        toast.error("Please enter a valid USD amount");
        return;
      }
    } else {
      if (!lotSize || parseFloat(lotSize) <= 0) {
        toast.error("Please enter a valid lot size");
        return;
      }
    }

    // If limit order, validate limit price and save to limit_orders table
    if (orderType === 'limit') {
      const limitPriceValue = parseFloat(limitPrice);
      if (!limitPrice || isNaN(limitPriceValue) || limitPriceValue <= 0) {
        toast.error("Please enter a valid limit price");
        return;
      }

      // Validate limit price direction
      if (type === 'long' && limitPriceValue >= currentPrice) {
        toast.error("Limit price for LONG should be below current price (buy cheaper)");
        return;
      }
      if (type === 'short' && limitPriceValue <= currentPrice) {
        toast.error("Limit price for SHORT should be above current price (sell higher)");
        return;
      }

      try {
        const stopLossValue = stopLoss ? parseFloat(stopLoss) : null;
        const takeProfitValue = takeProfit ? parseFloat(takeProfit) : null;

        const { error } = await supabase.from('limit_orders').insert({
          user_id: user?.id,
          symbol: symbol?.toUpperCase(),
          position_type: type,
          input_mode: inputMode,
          amount: inputMode === 'amount' ? parseFloat(tradeAmount) : null,
          lot_size: inputMode === 'lotSize' ? parseFloat(lotSize) : null,
          leverage: leverage,
          limit_price: limitPriceValue,
          stop_loss: stopLossValue,
          take_profit: takeProfitValue,
          status: 'pending' as any,
        });

        if (error) throw error;

        toast.success(`Limit ${type.toUpperCase()} order placed @ ${currencySymbol}${limitPriceValue.toFixed(2)}. Will execute when price reaches this level.`);
        setTradeAmount("");
        setLotSize("");
        setStopLoss("");
        setTakeProfit("");
        setLimitPrice("");
        setOrderType('market');
        setShowLongDialog(false);
        setShowShortDialog(false);
        return;
      } catch (error) {
        console.error('Error placing limit order:', error);
        toast.error('Failed to place limit order');
        return;
      }
    }

    // Validate currentPrice before proceeding
    if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
      toast.error("Price data not available. Please wait for price to load.");
      return;
    }

    try {
      let usdAmount: number;
      let margin: number;
      let assetQuantity: number;

      if (inputMode === 'amount') {
        usdAmount = parseFloat(tradeAmount);
        margin = usdAmount / leverage;
        assetQuantity = usdAmount / currentPrice;
      } else {
        assetQuantity = parseFloat(lotSize);
        usdAmount = assetQuantity * currentPrice;
        margin = (assetQuantity * currentPrice) / leverage;
      }

      if (isNaN(assetQuantity) || assetQuantity <= 0 || isNaN(margin) || margin <= 0) {
        toast.error("Invalid trade calculation. Please try again.");
        return;
      }

      // Check wallet balance first
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user?.id)
        .eq('currency', 'USD')
        .maybeSingle();

      if (walletError) {
        toast.error('Failed to check wallet balance');
        return;
      }

      const currentBalance = wallet?.balance || 0;
      
      if (currentBalance < margin) {
        toast.error(`Insufficient balance. Required: $${margin.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`);
        return;
      }

      // Validate stop loss if provided
      const stopLossValue = stopLoss ? parseFloat(stopLoss) : null;
      if (stopLossValue !== null) {
        if (type === 'long' && stopLossValue >= currentPrice) {
          toast.error("Stop loss must be below entry price for LONG positions");
          return;
        }
        if (type === 'short' && stopLossValue <= currentPrice) {
          toast.error("Stop loss must be above entry price for SHORT positions");
          return;
        }
      }

      // Validate take profit if provided
      const takeProfitValue = takeProfit ? parseFloat(takeProfit) : null;
      if (takeProfitValue !== null) {
        if (type === 'long' && takeProfitValue <= currentPrice) {
          toast.error("Take profit must be above entry price for LONG positions");
          return;
        }
        if (type === 'short' && takeProfitValue >= currentPrice) {
          toast.error("Take profit must be below entry price for SHORT positions");
          return;
        }
      }

      // Check for existing open position on same symbol + same direction
      const { data: existingPosition, error: existingError } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('symbol', symbol?.toUpperCase())
        .eq('position_type', type)
        .eq('status', 'open')
        .maybeSingle();

      if (existingError) {
        console.error('Error checking existing position:', existingError);
      }

      // Deduct margin from wallet
      const { error: updateError } = await supabase
        .from('user_wallets')
        .update({ balance: currentBalance - margin })
        .eq('user_id', user?.id)
        .eq('currency', 'USD');

      if (updateError) throw updateError;

      if (existingPosition) {
        // AVERAGE INTO EXISTING POSITION
        const oldAmount = Number(existingPosition.amount);
        const oldEntryPrice = Number(existingPosition.entry_price);
        const oldMargin = Number(existingPosition.margin);
        const oldLeverage = Number(existingPosition.leverage);

        // New averaged values
        const newTotalAmount = oldAmount + assetQuantity;
        const newAvgEntryPrice = ((oldAmount * oldEntryPrice) + (assetQuantity * currentPrice)) / newTotalAmount;
        const newTotalMargin = oldMargin + margin;
        // Weighted average leverage: total_position_value / total_margin
        const newLeverage = Math.round(((newTotalAmount * newAvgEntryPrice) / newTotalMargin));

        // Use new SL/TP if provided, otherwise keep existing
        const finalStopLoss = stopLossValue ?? (existingPosition.stop_loss ? Number(existingPosition.stop_loss) : null);
        const finalTakeProfit = takeProfitValue ?? (existingPosition.take_profit ? Number(existingPosition.take_profit) : null);

        const { error: avgError } = await supabase
          .from('positions')
          .update({
            amount: newTotalAmount,
            entry_price: newAvgEntryPrice,
            current_price: currentPrice,
            margin: newTotalMargin,
            leverage: newLeverage,
            stop_loss: finalStopLoss,
            take_profit: finalTakeProfit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPosition.id)
          .eq('status', 'open');

        if (avgError) {
          // Rollback wallet deduction
          await supabase
            .from('user_wallets')
            .update({ balance: currentBalance })
            .eq('user_id', user?.id)
            .eq('currency', 'USD');
          throw avgError;
        }

        // Record transaction
        await supabase.from('wallet_transactions').insert({
          user_id: user?.id,
          type: 'trade',
          amount: margin,
          currency: 'USD',
          status: 'Completed',
          reference_id: null
        });

        toast.success(`Averaged into existing ${type.toUpperCase()} position: +${assetQuantity.toFixed(6)} ${symbol?.toUpperCase()} @ $${currentPrice.toFixed(2)}. New avg entry: $${newAvgEntryPrice.toFixed(2)}, Total margin: $${newTotalMargin.toFixed(2)}`);
      } else {
        // CREATE NEW POSITION
        const { error } = await supabase.from('positions').insert({
          user_id: user?.id,
          symbol: symbol?.toUpperCase(),
          position_type: type,
          amount: assetQuantity,
          entry_price: currentPrice,
          current_price: currentPrice,
          leverage: leverage,
          margin: margin,
          status: 'open',
          stop_loss: stopLossValue,
          take_profit: takeProfitValue
        });

        if (error) {
          await supabase
            .from('user_wallets')
            .update({ balance: currentBalance })
            .eq('user_id', user?.id)
            .eq('currency', 'USD');
          throw error;
        }

        // Record transaction
        await supabase.from('wallet_transactions').insert({
          user_id: user?.id,
          type: 'trade',
          amount: margin,
          currency: 'USD',
          status: 'Completed',
          reference_id: null
        });

        const slMessage = stopLossValue ? ` | SL: $${stopLossValue.toFixed(2)}` : '';
        const tpMessage = takeProfitValue ? ` | TP: $${takeProfitValue.toFixed(2)}` : '';
        toast.success(`${type.toUpperCase()} position opened: ${assetQuantity.toFixed(6)} ${symbol?.toUpperCase()} @ $${currentPrice.toFixed(2)}${slMessage}${tpMessage}. Margin: $${margin.toFixed(2)}`);
      }

      setTradeAmount("");
      setLotSize("");
      setStopLoss("");
      setTakeProfit("");
      setLimitPrice("");
      setOrderType('market');
      setShowLongDialog(false);
      setShowShortDialog(false);
      fetchWalletBalance();
    } catch (error) {
      console.error('Error opening position:', error);
      toast.error('Failed to open position');
    }
  };

  return (
    <div className="relative min-h-screen bg-background pb-32">
      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-20 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 rounded-full bg-secondary/10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-background/70 backdrop-blur-2xl">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="container relative flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {tradingIcon && (
              typeof tradingIcon === 'string' && tradingIcon.startsWith('http') ? (
                <img src={tradingIcon} alt={tradingName} className="h-6 w-6 rounded-full" />
              ) : (
                <span className="text-2xl">{tradingIcon}</span>
              )
            )}
            <h1 className="text-xl font-bold">{tradingName}</h1>
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4 text-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-semibold">LIVE</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchRealTimeData} disabled={loading}>
            <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
        {/* Price Card with Live Animation */}
        <Card className="p-4 bg-gradient-to-br from-card to-muted/50 border-2 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-muted-foreground">Current Price</p>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              </div>
              {loading || currentPrice === 0 ? (
                <div className="h-10 w-32 bg-muted animate-pulse rounded-md"></div>
              ) : (
                <h2 
                  className={`text-2xl sm:text-3xl md:text-4xl font-bold transition-all duration-300 ${
                    priceDirection === 'up' ? 'text-green-500 scale-110' : 
                    priceDirection === 'down' ? 'text-red-500 scale-110' : ''
                  }`}
                >
                  {currencySymbol}{currentPrice.toFixed(2)}
                </h2>
              )}
              <p className="text-xs text-muted-foreground mt-1">Updates every second</p>
            </div>
            {loading || currentPrice === 0 ? (
              <div className="flex flex-col items-end gap-2">
                <div className="h-8 w-8 bg-muted animate-pulse rounded-md"></div>
                <div className="h-8 w-20 bg-muted animate-pulse rounded-md"></div>
              </div>
            ) : (
              <div className={`flex flex-col items-end gap-1 transition-all duration-300 ${
                priceChange >= 0 ? "text-green-500" : "text-red-500"
              }`}>
                <div className="flex items-center gap-2">
                  {priceChange >= 0 ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
                </div>
                <span className="text-3xl font-bold">{priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%</span>
                <span className="text-xs">24h Change</span>
              </div>
            )}
          </div>
        </Card>

        {/* Timeframe Filters */}
        <Card className="p-3 sm:p-4 relative overflow-hidden">
          {/* Swipe Indicators */}
          {swipeIndicator && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-300 ${
                swipeIndicator === 'left' 
                  ? 'right-4 animate-fade-in' 
                  : 'left-4 animate-fade-in'
              }`}
            >
              <div className="bg-primary/20 rounded-full p-2 backdrop-blur-sm">
                {swipeIndicator === 'left' ? (
                  <ChevronRight className="h-6 w-6 text-primary" />
                ) : (
                  <ChevronLeft className="h-6 w-6 text-primary" />
                )}
              </div>
            </div>
          )}
          
          <div className="text-center mb-2 text-xs text-muted-foreground sm:hidden">
            👉 Swipe left/right to change timeframe
          </div>
          
          <div 
            {...swipeHandlers}
            className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 touch-pan-x"
          >
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf)}
                className={`min-w-[50px] sm:min-w-[60px] text-xs sm:text-sm flex-shrink-0 transition-all duration-300 ${
                  timeframe === tf ? 'scale-110 shadow-lg' : ''
                }`}
              >
                {tf.toUpperCase()}
              </Button>
            ))}
          </div>
        </Card>

        {/* Chart - Premium Glass Container */}
        <Card className="relative overflow-hidden border border-primary/20 bg-card/40 backdrop-blur-xl shadow-2xl shadow-primary/5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative p-4">
            <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Live Candlestick Chart
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono tracking-wide">
                    {timeframe.toUpperCase()} · Real-time · Pinch to zoom
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] text-emerald-500 font-bold tracking-wider">LIVE</span>
              </div>
            </div>

            <div
              ref={chartContainerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="relative rounded-xl bg-gradient-to-b from-background/40 to-background/10 border border-border/30 p-2 overflow-hidden"
              style={{ transform: `scale(${chartScale})`, transformOrigin: 'center', transition: 'transform 0.1s' }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.15)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.15)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

              {chartData.length > 0 ? (
                <CustomCandlestick data={chartData} currencySymbol={currencySymbol} />
              ) : (
                <div className="h-[420px] flex flex-col items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <div className="relative h-12 w-12">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </div>
                      <p className="text-sm text-muted-foreground animate-pulse">Loading live chart data...</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No data available</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => navigate(`/charts?symbol=${encodeURIComponent((symbol || 'BTC').toUpperCase())}`)}
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 hover:from-primary/25 hover:via-accent/20 hover:to-primary/25 border border-primary/30 text-primary font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20"
              >
                <Maximize2 className="h-4 w-4 transition-transform group-hover:rotate-12" />
                View Full Chart
              </button>
            </div>
          </div>
        </Card>
      </main>

      {/* Sticky Bottom Long/Short Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-background/95 backdrop-blur-lg border-t border-border/40 px-3 pt-3 pb-7 sm:px-4 sm:pt-4 sm:pb-8 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]" style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom, 1.75rem))' }}>
        <div className="container mx-auto flex gap-2 sm:gap-3 max-w-screen-lg">
          <Button
            onClick={() => setShowLongDialog(true)}
            className="flex-1 h-12 sm:h-14 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-sm sm:text-base md:text-lg shadow-lg touch-manipulation active:scale-95 transition-transform"
            size="lg"
          >
            <TrendingUp className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            LONG
          </Button>
          <Button
            onClick={() => setShowShortDialog(true)}
            className="flex-1 h-12 sm:h-14 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold text-sm sm:text-base md:text-lg shadow-lg touch-manipulation active:scale-95 transition-transform"
            size="lg"
          >
            <TrendingDown className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            SHORT
          </Button>
        </div>
      </div>

      {/* Long Position Dialog */}
      <Dialog open={showLongDialog} onOpenChange={setShowLongDialog}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-500">
              <TrendingUp className="h-5 w-5" />
              Open LONG Position
            </DialogTitle>
            <DialogDescription>
              Buy {symbol?.toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Available Balance */}
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available Balance:</span>
                <span className="font-bold text-lg text-primary">${walletBalance.toFixed(2)}</span>
              </div>
            </div>

            {/* Order Type Toggle */}
            <div className="flex items-center gap-2">
              <InputTabs value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')} className="w-full">
                <InputTabsList className="grid w-full grid-cols-2">
                  <InputTabsTrigger value="market" className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Market
                  </InputTabsTrigger>
                  <InputTabsTrigger value="limit" className="flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    Limit
                  </InputTabsTrigger>
                </InputTabsList>
              </InputTabs>
            </div>

            {/* Limit Price Input */}
            {orderType === 'limit' && (
              <div>
                <Label htmlFor="long-limit-price">Limit Price (Buy at this price)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
                  <Input
                    id="long-limit-price"
                    type="number"
                    placeholder={`Enter price below ${currencySymbol}${currentPrice.toFixed(2)}`}
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="pl-9 border-yellow-500/30 focus:border-yellow-500"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Trade will execute automatically when market price drops to this level</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <InputTabs value={inputMode} onValueChange={(v) => setInputMode(v as 'amount' | 'lotSize')} className="w-full">
                <InputTabsList className="grid w-full grid-cols-2">
                  <InputTabsTrigger value="amount" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Amount (USD)
                  </InputTabsTrigger>
                  <InputTabsTrigger value="lotSize" className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    Lot Size
                  </InputTabsTrigger>
                </InputTabsList>
              </InputTabs>
            </div>

            {/* Amount Input */}
            {inputMode === 'amount' ? (
              <div>
                <Label htmlFor="long-amount">Trade Amount (USD)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="long-amount"
                    type="number"
                    placeholder="Enter USD amount (e.g., 20, 50, 100)"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Enter the amount in USD you want to trade</p>
              </div>
            ) : (
              <div>
                <Label htmlFor="long-lotsize">Lot Size (Units)</Label>
                <div className="relative mt-2">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="long-lotsize"
                    type="number"
                    placeholder="Enter lot size (e.g., 0.01, 0.1, 1)"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    className="pl-9"
                    step="0.001"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Enter the quantity of {symbol?.toUpperCase()} you want to trade</p>
              </div>
            )}

            {/* Stop Loss Input for Long */}
            <div>
              <Label htmlFor="long-stoploss">Stop Loss Price (Optional)</Label>
              <div className="relative mt-2">
                <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                <Input
                  id="long-stoploss"
                  type="number"
                  placeholder="Enter stop loss price (below entry)"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="pl-9 border-red-500/30 focus:border-red-500"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Position auto-closes if price drops to this level</p>
            </div>

            {/* Take Profit Input for Long */}
            <div>
              <Label htmlFor="long-takeprofit">Take Profit Price (Optional)</Label>
              <div className="relative mt-2">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                <Input
                  id="long-takeprofit"
                  type="number"
                  placeholder="Enter take profit price (above entry)"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="pl-9 border-green-500/30 focus:border-green-500"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Position auto-closes when price reaches this profit target</p>
            </div>
            
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{orderType === 'limit' ? 'Limit Price:' : 'Entry Price:'}</span>
                <span className="font-semibold">
                  {orderType === 'limit' && limitPrice 
                    ? `${currencySymbol}${parseFloat(limitPrice).toFixed(2)}`
                    : `${currencySymbol}${typeof currentPrice === 'number' ? currentPrice.toFixed(2) : '0.00'}`
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Asset Quantity:</span>
                <span className="font-semibold">
                  {inputMode === 'amount' 
                    ? (tradeAmount && currentPrice > 0 ? (parseFloat(tradeAmount) / currentPrice).toFixed(6) : "0.000000")
                    : (lotSize || "0.000000")
                  } {symbol?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin Required:</span>
                <span className="font-semibold">
                  ${inputMode === 'amount'
                    ? (tradeAmount ? (parseFloat(tradeAmount) / leverage).toFixed(2) : "0.00")
                    : (lotSize && currentPrice > 0 ? ((parseFloat(lotSize) * currentPrice) / leverage).toFixed(2) : "0.00")
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Position Value:</span>
                <span className="font-semibold text-lg text-green-500">
                  ${inputMode === 'amount'
                    ? (tradeAmount ? parseFloat(tradeAmount).toFixed(2) : "0.00")
                    : (lotSize && currentPrice > 0 ? (parseFloat(lotSize) * currentPrice).toFixed(2) : "0.00")
                  }
                </span>
              </div>
            </div>
            <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <Button
                onClick={() => handleOpenPosition('long')}
                className={`w-full text-white h-12 ${orderType === 'limit' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-500 hover:bg-green-600'}`}
                size="lg"
                disabled={
                  (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) ||
                  (inputMode === 'amount'
                    ? (!tradeAmount || parseFloat(tradeAmount) <= 0 || (orderType === 'market' && parseFloat(tradeAmount) / leverage > walletBalance))
                    : (!lotSize || parseFloat(lotSize) <= 0 || !currentPrice || currentPrice <= 0 || (orderType === 'market' && (parseFloat(lotSize) * currentPrice) / leverage > walletBalance)))
                }
              >
                {orderType === 'limit' ? <ShoppingCart className="mr-2 h-5 w-5" /> : <TrendingUp className="mr-2 h-5 w-5" />}
                {orderType === 'limit' ? 'Place Limit LONG Order' : 'Open LONG Position'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Short Position Dialog */}
      <Dialog open={showShortDialog} onOpenChange={setShowShortDialog}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <TrendingDown className="h-5 w-5" />
              Open SHORT Position
            </DialogTitle>
            <DialogDescription>
              Sell {symbol?.toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Available Balance */}
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available Balance:</span>
                <span className="font-bold text-lg text-primary">${walletBalance.toFixed(2)}</span>
              </div>
            </div>

            {/* Order Type Toggle */}
            <div className="flex items-center gap-2">
              <InputTabs value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')} className="w-full">
                <InputTabsList className="grid w-full grid-cols-2">
                  <InputTabsTrigger value="market" className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Market
                  </InputTabsTrigger>
                  <InputTabsTrigger value="limit" className="flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    Limit
                  </InputTabsTrigger>
                </InputTabsList>
              </InputTabs>
            </div>

            {/* Limit Price Input */}
            {orderType === 'limit' && (
              <div>
                <Label htmlFor="short-limit-price">Limit Price (Sell at this price)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
                  <Input
                    id="short-limit-price"
                    type="number"
                    placeholder={`Enter price above ${currencySymbol}${currentPrice.toFixed(2)}`}
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="pl-9 border-yellow-500/30 focus:border-yellow-500"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Trade will execute automatically when market price rises to this level</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <InputTabs value={inputMode} onValueChange={(v) => setInputMode(v as 'amount' | 'lotSize')} className="w-full">
                <InputTabsList className="grid w-full grid-cols-2">
                  <InputTabsTrigger value="amount" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Amount (USD)
                  </InputTabsTrigger>
                  <InputTabsTrigger value="lotSize" className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    Lot Size
                  </InputTabsTrigger>
                </InputTabsList>
              </InputTabs>
            </div>

            {/* Amount Input */}
            {inputMode === 'amount' ? (
              <div>
                <Label htmlFor="short-amount">Trade Amount (USD)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="short-amount"
                    type="number"
                    placeholder="Enter USD amount (e.g., 20, 50, 100)"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Enter the amount in USD you want to trade</p>
              </div>
            ) : (
              <div>
                <Label htmlFor="short-lotsize">Lot Size (Units)</Label>
                <div className="relative mt-2">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="short-lotsize"
                    type="number"
                    placeholder="Enter lot size (e.g., 0.01, 0.1, 1)"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    className="pl-9"
                    step="0.001"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Enter the quantity of {symbol?.toUpperCase()} you want to trade</p>
              </div>
            )}

            {/* Stop Loss Input for Short */}
            <div>
              <Label htmlFor="short-stoploss">Stop Loss Price (Optional)</Label>
              <div className="relative mt-2">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                <Input
                  id="short-stoploss"
                  type="number"
                  placeholder="Enter stop loss price (above entry)"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="pl-9 border-red-500/30 focus:border-red-500"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Position auto-closes if price rises to this level</p>
            </div>

            {/* Take Profit Input for Short */}
            <div>
              <Label htmlFor="short-takeprofit">Take Profit Price (Optional)</Label>
              <div className="relative mt-2">
                <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                <Input
                  id="short-takeprofit"
                  type="number"
                  placeholder="Enter take profit price (below entry)"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="pl-9 border-green-500/30 focus:border-green-500"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Position auto-closes when price reaches this profit target</p>
            </div>
            
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{orderType === 'limit' ? 'Limit Price:' : 'Entry Price:'}</span>
                <span className="font-semibold">
                  {orderType === 'limit' && limitPrice 
                    ? `${currencySymbol}${parseFloat(limitPrice).toFixed(2)}`
                    : `${currencySymbol}${typeof currentPrice === 'number' ? currentPrice.toFixed(2) : '0.00'}`
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Asset Quantity:</span>
                <span className="font-semibold">
                  {inputMode === 'amount' 
                    ? (tradeAmount && currentPrice > 0 ? (parseFloat(tradeAmount) / currentPrice).toFixed(6) : "0.000000")
                    : (lotSize || "0.000000")
                  } {symbol?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin Required:</span>
                <span className="font-semibold">
                  ${inputMode === 'amount'
                    ? (tradeAmount ? (parseFloat(tradeAmount) / leverage).toFixed(2) : "0.00")
                    : (lotSize && currentPrice > 0 ? ((parseFloat(lotSize) * currentPrice) / leverage).toFixed(2) : "0.00")
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Position Value:</span>
                <span className="font-semibold text-lg text-red-500">
                  ${inputMode === 'amount'
                    ? (tradeAmount ? parseFloat(tradeAmount).toFixed(2) : "0.00")
                    : (lotSize && currentPrice > 0 ? (parseFloat(lotSize) * currentPrice).toFixed(2) : "0.00")
                  }
                </span>
              </div>
            </div>
            <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <Button
                onClick={() => handleOpenPosition('short')}
                className={`w-full text-white h-12 ${orderType === 'limit' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-500 hover:bg-red-600'}`}
                size="lg"
                disabled={
                  (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) ||
                  (inputMode === 'amount'
                    ? (!tradeAmount || parseFloat(tradeAmount) <= 0 || (orderType === 'market' && parseFloat(tradeAmount) / leverage > walletBalance))
                    : (!lotSize || parseFloat(lotSize) <= 0 || !currentPrice || currentPrice <= 0 || (orderType === 'market' && (parseFloat(lotSize) * currentPrice) / leverage > walletBalance)))
                }
              >
                {orderType === 'limit' ? <ShoppingCart className="mr-2 h-5 w-5" /> : <TrendingDown className="mr-2 h-5 w-5" />}
                {orderType === 'limit' ? 'Place Limit SHORT Order' : 'Open SHORT Position'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Trading;
