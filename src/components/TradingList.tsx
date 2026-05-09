import { TrendingUp, TrendingDown, Activity, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";

interface TradingItem {
  name: string;
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
  icon?: LucideIcon | string;
  logo?: string;
  currencySymbol?: string;
  high24h?: string;
  low24h?: string;
}

interface TradingListProps {
  data: TradingItem[];
  momentumEnabled?: boolean;
}

const TradingList = ({ data, momentumEnabled = true }: TradingListProps) => {
  const navigate = useNavigate();
  const [itemMomentum, setItemMomentum] = useState<Record<number, 'up' | 'down' | 'neutral'>>({});
  const [priceFluctuations, setPriceFluctuations] = useState<Record<number, number>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const basePricesRef = useRef<Record<number, number>>({});

  // Store base prices from data
  useEffect(() => {
    data.forEach((item, index) => {
      const numericPrice = parseFloat(item.price.replace(/,/g, ''));
      if (!isNaN(numericPrice) && !basePricesRef.current[index]) {
        basePricesRef.current[index] = numericPrice;
      }
    });
  }, [data]);

  useEffect(() => {
    if (!momentumEnabled) {
      setItemMomentum({});
      setPriceFluctuations({});
      return;
    }

    // Initialize base prices
    const initPrices: Record<number, number> = {};
    data.forEach((item, index) => {
      const numericPrice = parseFloat(item.price.replace(/,/g, ''));
      if (!isNaN(numericPrice)) {
        initPrices[index] = numericPrice;
      }
    });
    basePricesRef.current = { ...basePricesRef.current, ...initPrices };

    // Live momentum micro-fluctuations
    intervalRef.current = setInterval(() => {
      const newMomentum: Record<number, 'up' | 'down' | 'neutral'> = {};
      const newFluctuations: Record<number, number> = {};

      data.forEach((_, index) => {
        const basePrice = basePricesRef.current[index];
        if (!basePrice) return;

        const direction = Math.random();
        const fluctuationPercent = (Math.random() * 0.0014 + 0.0001); // ±0.01% to ±0.15%
        const sign = direction > 0.5 ? 1 : -1;
        const newPrice = basePrice * (1 + sign * fluctuationPercent);

        newFluctuations[index] = newPrice;
        newMomentum[index] = sign > 0 ? 'up' : 'down';
      });

      setPriceFluctuations(newFluctuations);
      setItemMomentum(newMomentum);
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [data.length, momentumEnabled]);

  // Format price based on its magnitude
  const formatPrice = (price: number, originalPrice: string): string => {
    // Check if original has decimal places to maintain format
    const hasDecimals = originalPrice.includes('.');
    const originalDecimals = hasDecimals ? originalPrice.split('.')[1]?.replace(/,/g, '').length || 2 : 0;
    
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: Math.min(originalDecimals, 2), maximumFractionDigits: Math.min(originalDecimals, 2) });
    } else if (price >= 1) {
      return price.toFixed(Math.min(originalDecimals, 4));
    } else {
      return price.toFixed(Math.min(originalDecimals, 6));
    }
  };

  const handleClick = (item: TradingItem) => {
    navigate(`/trading/${item.symbol.toLowerCase()}`, {
      state: { 
        price: item.price,
        name: item.name,
        logo: item.logo,
        icon: item.icon,
        currencySymbol: item.currencySymbol || '$'
      }
    });
  };

  return (
    <div className="space-y-2 sm:space-y-3 w-full overflow-hidden">
      {data.map((item, index) => {
        const IconComponent = item.icon;
        const displayPrice = momentumEnabled && priceFluctuations[index] 
          ? formatPrice(priceFluctuations[index], item.price)
          : item.price;
        
        return (
          <div
            key={index}
            onClick={() => handleClick(item)}
            className="flex items-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-md cursor-pointer active:scale-[0.98] w-full overflow-hidden"
          >
            {/* Left: Icon and Name */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 relative">
                {item.logo ? (
                  <img src={item.logo} alt={item.name} className="h-5 w-5 sm:h-8 sm:w-8" />
                ) : typeof item.icon === 'string' ? (
                  <span className="text-lg sm:text-2xl">{item.icon}</span>
                ) : IconComponent ? (
                  <IconComponent className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                ) : null}
                {/* Live momentum indicator */}
                {itemMomentum[index] && itemMomentum[index] !== 'neutral' && (
                  <div className={`absolute -top-0.5 -right-0.5 h-2 w-2 sm:h-3 sm:w-3 rounded-full animate-pulse ${
                    itemMomentum[index] === 'up' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs sm:text-base truncate flex items-center gap-1">
                  <span className="truncate max-w-[80px] sm:max-w-none">{item.name}</span>
                  <Activity className={`h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 transition-all duration-300 ${
                    itemMomentum[index] === 'up' ? 'text-green-500 animate-pulse' :
                    itemMomentum[index] === 'down' ? 'text-red-500 animate-pulse' :
                    'text-muted-foreground opacity-50'
                  }`} />
                </div>
                <div className={`text-[10px] sm:text-sm font-medium flex items-center gap-1 ${
                  item.isPositive 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {item.change}
                  {itemMomentum[index] && (
                    <span className={`text-[10px] sm:text-xs transition-all duration-300 ${
                      itemMomentum[index] === 'up' ? 'text-green-500' :
                      itemMomentum[index] === 'down' ? 'text-red-500' :
                      'text-muted-foreground'
                    }`}>
                      {itemMomentum[index] === 'up' ? '↗' : itemMomentum[index] === 'down' ? '↘' : '→'}
                    </span>
                  )}
                </div>
                {item.high24h && item.low24h && (
                  <div className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 flex gap-1 sm:gap-2">
                    <span className="text-green-600 dark:text-green-400">H: {item.currencySymbol || '$'}{item.high24h}</span>
                    <span className="text-red-600 dark:text-red-400">L: {item.currencySymbol || '$'}{item.low24h}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right: Price and Percentage */}
            <div className="text-right flex-shrink-0 ml-2 max-w-[100px] sm:max-w-none">
              <div className={`font-bold text-xs sm:text-lg mb-0.5 transition-all duration-300 truncate ${
                itemMomentum[index] === 'up' ? 'text-green-500 scale-105' :
                itemMomentum[index] === 'down' ? 'text-red-500 scale-95' :
                ''
              }`}>
                {item.currencySymbol || '$'}{displayPrice}
              </div>
              <div className={`text-[10px] sm:text-sm font-semibold flex items-center justify-end gap-0.5 ${
                item.isPositive 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {item.isPositive ? (
                  <TrendingUp className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                )}
                <span className="hidden sm:inline">{item.change}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TradingList;
