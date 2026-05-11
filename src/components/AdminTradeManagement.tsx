import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeForexData } from "@/lib/forexCache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Edit, X, ArrowUp, ArrowDown, Plus, Minus, Search, ChevronLeft, ChevronRight, Users, Eye, History, Coins, RotateCcw, Lock, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isCommoditySymbol, isForexSymbol } from "@/lib/marketSymbols";
import { modeLogger } from "@/lib/modeEventLogger";

interface User {
  id: string;
  full_name: string;
  email: string;
}

interface Position {
  id: string;
  user_id: string;
  symbol: string;
  position_type: 'long' | 'short';
  amount: number;
  entry_price: number;
  current_price: number;
  leverage: number;
  margin: number;
  status: 'open' | 'closed';
  price_mode?: string;
  pnl?: number;
  closed_at?: string;
  close_price?: number;
  profiles?: {
    full_name?: string;
    email?: string;
  };
}

interface UserWithTrades {
  id: string;
  full_name: string;
  email: string;
  tradeCount: number;
  totalPnL: number;
}

interface AssetOption {
  symbol: string;
  name: string;
  price?: number;
}

const TRADES_PER_PAGE = 10;

// Predefined asset lists
const CRYPTO_ASSETS: AssetOption[] = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "BNB", name: "Binance Coin" },
  { symbol: "XRP", name: "Ripple" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "MATIC", name: "Polygon" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "AVAX", name: "Avalanche" },
];

const FOREX_ASSETS: AssetOption[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar" },
  { symbol: "GBP/USD", name: "British Pound / US Dollar" },
  { symbol: "JPY/USD", name: "Japanese Yen / US Dollar" },
  { symbol: "CHF/USD", name: "Swiss Franc / US Dollar" },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar" },
  { symbol: "CAD/USD", name: "Canadian Dollar / US Dollar" },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar" },
  { symbol: "INR/USD", name: "Indian Rupee / US Dollar" },
  { symbol: "CNY/USD", name: "Chinese Yuan / US Dollar" },
  { symbol: "SGD/USD", name: "Singapore Dollar / US Dollar" },
];

const COMMODITIES_ASSETS: AssetOption[] = [
  { symbol: "XAU", name: "Gold" },
  { symbol: "XAG", name: "Silver" },
  { symbol: "WTI", name: "Crude Oil" },
  { symbol: "BRENT", name: "Brent Oil" },
  { symbol: "NG", name: "Natural Gas" },
  { symbol: "XCU", name: "Copper" },
  { symbol: "XPT", name: "Platinum" },
  { symbol: "XPD", name: "Palladium" },
];

export const AdminTradeManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [openTradeDialog, setOpenTradeDialog] = useState(false);
  const [editTradeDialog, setEditTradeDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [priceChanges, setPriceChanges] = useState<Record<string, { direction: 'up' | 'down' | 'none'; flash: boolean }>>({});
  const previousPricesRef = useRef<Record<string, number>>({});
  const positionsRef = useRef<Position[]>([]);
  // Store base PnL for edited trades (admin-set values that don't change)
  const basePnlRef = useRef<Record<string, number>>({});
  
  // Keep positions ref in sync
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);
  
  // View state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tradeViewTab, setTradeViewTab] = useState<'open' | 'closed'>('open');
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  
  // Trade form fields
  const [assetType, setAssetType] = useState<'crypto' | 'forex' | 'commodities'>('crypto');
  const [symbol, setSymbol] = useState("");
  const [positionType, setPositionType] = useState<'long' | 'short'>('long');
  const [amount, setAmount] = useState("");
  const [lotSize, setLotSize] = useState("");
  const [inputMode, setInputMode] = useState<'amount' | 'lotSize'>('amount');
  const [entryPrice, setEntryPrice] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [priceMode, setPriceMode] = useState<'live' | 'manual'>('live');
  const [adjustPnlPositionId, setAdjustPnlPositionId] = useState<string | null>(null);
  const [targetPnlPercent, setTargetPnlPercent] = useState("");
  const [selectedUserBalance, setSelectedUserBalance] = useState<number | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [fetchedPrice, setFetchedPrice] = useState<number | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [currentPriceEdit, setCurrentPriceEdit] = useState("");

  // Get available assets based on asset type
  const availableAssets = useMemo(() => {
    switch (assetType) {
      case 'crypto':
        return CRYPTO_ASSETS;
      case 'forex':
        return FOREX_ASSETS;
      case 'commodities':
        return COMMODITIES_ASSETS;
      default:
        return CRYPTO_ASSETS;
    }
  }, [assetType]);

  // Calculate margin and position size based on input mode
  const calculatedValues = useMemo(() => {
    if (inputMode === 'amount') {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) return null;
      const margin = amountNum;
      const lev = parseInt(leverage);
      // Calculate lot size if we have a price
      const price = fetchedPrice || parseFloat(entryPrice);
      const lotSizeCalc = price > 0 ? (margin * lev) / price : 0;
      return { margin, lotSize: lotSizeCalc, positionValue: margin * lev };
    } else {
      // Lot size mode
      const lotSizeNum = parseFloat(lotSize);
      if (isNaN(lotSizeNum) || lotSizeNum <= 0) return null;
      const lev = parseInt(leverage);
      const price = fetchedPrice || parseFloat(entryPrice);
      if (price <= 0) return { margin: 0, lotSize: lotSizeNum, positionValue: 0 };
      // margin = (lotSize * price) / leverage
      const margin = (lotSizeNum * price) / lev;
      return { margin, lotSize: lotSizeNum, positionValue: lotSizeNum * price };
    }
  }, [amount, lotSize, inputMode, leverage, fetchedPrice, entryPrice]);

  // Filter users for search in dialog
  const filteredUsersForDialog = useMemo(() => {
    let filtered = users;
    
    // Apply letter filter first
    if (selectedLetter) {
      filtered = filtered.filter(user => {
        const name = user.full_name?.trim() || '';
        return name.toUpperCase().startsWith(selectedLetter);
      });
    }
    
    // Then apply search query
    if (userSearchQuery.trim()) {
      const query = userSearchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        (user.full_name?.toLowerCase() || '').includes(query) ||
        (user.email?.toLowerCase() || '').includes(query)
      );
    }
    
    return filtered;
  }, [users, userSearchQuery, selectedLetter]);

  // Get available letters from users
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    users.forEach(user => {
      const firstChar = user.full_name?.trim().charAt(0).toUpperCase();
      if (firstChar && /[A-Z]/.test(firstChar)) {
        letters.add(firstChar);
      }
    });
    return Array.from(letters).sort();
  }, [users]);

  // Fetch user balance when user is selected for trade
  const fetchUserBalance = async (userId: string) => {
    if (!userId) {
      setSelectedUserBalance(null);
      return;
    }
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('balance')
      .eq('user_id', userId)
      .eq('currency', 'USD')
      .single();
    
    setSelectedUserBalance(wallet?.balance ?? 0);
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    fetchUserBalance(userId);
  };

  useEffect(() => {
    fetchUsers();
    fetchPositions();
  }, []);

  // Fetch price when symbol changes for lot size calculations
  useEffect(() => {
    const fetchPriceForSymbol = async () => {
      if (!symbol || !openTradeDialog) {
        setFetchedPrice(null);
        return;
      }

      try {
        let price = 0;
        
        if (assetType === 'crypto') {
          const { data, error } = await supabase.functions.invoke('fetch-crypto-data');
          if (!error && data?.cryptoData) {
            const coin = data.cryptoData.find((c: any) => c.symbol.toUpperCase() === symbol.toUpperCase());
            if (coin) price = parseFloat(coin.price);
          }
        } else if (assetType === 'commodities') {
          const { data, error } = await supabase.functions.invoke('fetch-commodities-data');
          if (!error && data?.commoditiesData) {
            const commodity = data.commoditiesData.find((c: any) => c.symbol.toUpperCase() === symbol.toUpperCase());
            if (commodity) price = parseFloat(commodity.price);
          }
        } else if (assetType === 'forex') {
          const { data, error } = await invokeForexData();
          if (!error && data?.forexData) {
            const forex = data.forexData.find((f: any) => f.name?.toUpperCase() === symbol.toUpperCase() || f.symbol?.toUpperCase() === symbol.toUpperCase());
            if (forex) price = parseFloat(forex.price);
          }
        }
        
        setFetchedPrice(price > 0 ? price : null);
      } catch (err) {
        console.error('Error fetching price for symbol:', err);
        setFetchedPrice(null);
      }
    };

    fetchPriceForSymbol();
  }, [symbol, assetType, openTradeDialog]);

  // Real-time price updates for open positions
  useEffect(() => {
    if (positions.length === 0) return;
    
    const updatePrices = async () => {
      try {
        const currentPositions = positionsRef.current;
        if (currentPositions.length === 0) return;

        // Check if it's weekend (Saturday=6, Sunday=0)
        const today = new Date().getDay();
        const isWeekend = today === 0 || today === 6;

        // Fetch momentum settings
        let forexMomentumEnabled = true;
        let commoditiesMomentumEnabled = true;
        try {
          const { data: settingsData } = await supabase
            .from("payment_settings")
            .select("setting_key, setting_value")
            .in("setting_key", ["forex_momentum_enabled", "commodities_momentum_enabled"]);
          if (settingsData) {
            settingsData.forEach((s) => {
              if (s.setting_key === "forex_momentum_enabled") forexMomentumEnabled = s.setting_value !== "false";
              if (s.setting_key === "commodities_momentum_enabled") commoditiesMomentumEnabled = s.setting_value !== "false";
            });
          }
        } catch (err) {
          console.error("Error fetching momentum settings:", err);
        }

        const livePositions = currentPositions.filter(
          (p) => p.price_mode !== 'manual' && p.price_mode !== 'edited'
        );

        const cryptoSymbols = Array.from(
          new Set(
            livePositions
              .filter((p) => !isForexSymbol(p.symbol) && !isCommoditySymbol(p.symbol))
              .map((p) => p.symbol.toUpperCase())
          )
        );

        const [cryptoResponse, forexResponse, commoditiesResponse] = await Promise.all([
          cryptoSymbols.length > 0
            ? supabase.functions.invoke('fetch-crypto-data', { body: { symbols: cryptoSymbols } })
            : Promise.resolve({ data: null, error: null }),
          livePositions.some((p) => isForexSymbol(p.symbol))
            ? invokeForexData()
            : Promise.resolve({ data: null, error: null }),
          livePositions.some((p) => isCommoditySymbol(p.symbol))
            ? supabase.functions.invoke('fetch-commodities-data')
            : Promise.resolve({ data: null, error: null }),
        ]);

        const cryptoPrices: Record<string, number> = {};
        if (!cryptoResponse.error && cryptoResponse.data?.cryptoData) {
          cryptoResponse.data.cryptoData.forEach((coin: any) => {
            if (coin.symbol && coin.price) {
              cryptoPrices[coin.symbol.toUpperCase()] = parseFloat(coin.price);
            }
          });
        }

        const forexPrices: Record<string, number> = {};
        if (!forexResponse.error && forexResponse.data?.forexData) {
          forexResponse.data.forexData.forEach((forex: any) => {
            const price = parseFloat(forex.price);
            if (Number.isNaN(price) || price <= 0) return;

            const forexSymbol = (forex.symbol || '').toUpperCase();
            const forexName = (forex.name || '').toUpperCase();
            if (forexSymbol) forexPrices[forexSymbol] = price;
            if (forexName) forexPrices[forexName] = price;
          });
        }

        const commodityPrices: Record<string, number> = {};
        if (!commoditiesResponse.error && commoditiesResponse.data?.commoditiesData) {
          commoditiesResponse.data.commoditiesData.forEach((commodity: any) => {
            const commoditySymbol = (commodity.symbol || '').toUpperCase();
            const price = parseFloat(commodity.price);
            if (commoditySymbol && !Number.isNaN(price) && price > 0) {
              commodityPrices[commoditySymbol] = price;
            }
          });
        }
        
        const updatedPositions = await Promise.all(
          currentPositions.map(async (position) => {
            let currentPrice = position.current_price;
            let pnl: number;

            const symbol = position.symbol.toUpperCase();
            const isForex = isForexSymbol(symbol);
            const isCommodity = isCommoditySymbol(symbol);

            // Check if this is an edited trade (admin adjusted PnL)
            if (position.price_mode === 'edited') {
              // Skip momentum for forex/commodities on weekends or when momentum disabled
              if ((isForex && (isWeekend || !forexMomentumEnabled)) || 
                  (isCommodity && (isWeekend || !commoditiesMomentumEnabled))) {
                return position;
              }
              
              if (basePnlRef.current[position.id] === undefined) {
                basePnlRef.current[position.id] = position.pnl || 0;
              }
              const basePnl = basePnlRef.current[position.id];
              const isPositivePnl = basePnl >= 0;
              const basePnlPercent = position.margin > 0 ? (basePnl / position.margin) * 100 : 0;
              // Small slow momentum: 0.05-0.3% drift in PnL direction
              const momentumOffset = Math.random() * 0.25 + 0.05;
              let adjustedPnlPercent: number;
              
              if (isPositivePnl) {
                adjustedPnlPercent = basePnlPercent + momentumOffset;
              } else {
                adjustedPnlPercent = basePnlPercent - momentumOffset;
              }
              
              pnl = (adjustedPnlPercent / 100) * position.margin;
              const quantity = getEffectivePositionAmount(position);
              
              if (position.position_type === 'long') {
                currentPrice = position.entry_price + (quantity > 0 ? pnl / quantity : 0);
              } else {
                currentPrice = position.entry_price - (quantity > 0 ? pnl / quantity : 0);
              }
              currentPrice = Math.max(0.0001, currentPrice);
              
              const previousPrice = previousPricesRef.current[position.id];
              if (previousPrice !== undefined && previousPrice !== currentPrice) {
                const direction = currentPrice > previousPrice ? 'up' : 'down';
                setPriceChanges(prev => ({ ...prev, [position.id]: { direction, flash: true } }));
                setTimeout(() => {
                  setPriceChanges(prev => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
                }, 500);
              }
              previousPricesRef.current[position.id] = currentPrice;
              
              return { ...position, current_price: currentPrice, pnl };
            } else if (position.price_mode === 'manual') {
              // Skip momentum for forex/commodities on weekends or when momentum disabled
              if ((isForex && (isWeekend || !forexMomentumEnabled)) || 
                  (isCommodity && (isWeekend || !commoditiesMomentumEnabled))) {
                return position;
              }
              
              const randomPercent = (Math.random() * 4 + 1) * (Math.random() > 0.5 ? 1 : -1);
              currentPrice = position.entry_price * (1 + randomPercent / 100);
            } else {
              // Skip momentum for forex/commodities on weekends or when momentum disabled
              if ((isForex && (isWeekend || !forexMomentumEnabled)) || 
                  (isCommodity && (isWeekend || !commoditiesMomentumEnabled))) {
                return position;
              }
              
              if (!isForex && !isCommodity) {
                currentPrice = cryptoPrices[symbol] || currentPrice;
              } else if (isForex) {
                currentPrice = forexPrices[symbol] || currentPrice;
              } else if (isCommodity) {
                currentPrice = commodityPrices[symbol] || currentPrice;
              }

              if (currentPrice <= 0) return position;
            }

            // Track price changes for visual indicators (for non-edited trades)
            const previousPrice = previousPricesRef.current[position.id];
            if (previousPrice !== undefined && previousPrice !== currentPrice) {
              const direction = currentPrice > previousPrice ? 'up' : 'down';
              setPriceChanges(prev => ({ ...prev, [position.id]: { direction, flash: true } }));
              
              setTimeout(() => {
                setPriceChanges(prev => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
              }, 500);
            }
            
            previousPricesRef.current[position.id] = currentPrice;

            // Calculate PnL for manual and live trades
            const quantity = getEffectivePositionAmount(position);
            pnl = position.position_type === 'long'
              ? (currentPrice - position.entry_price) * quantity
              : (position.entry_price - currentPrice) * quantity;

            // Update database only for manual and live trades
            supabase
              .from('positions')
              .update({ 
                current_price: currentPrice,
                pnl: pnl,
                updated_at: new Date().toISOString()
              })
              .eq('id', position.id)
              .eq('status', 'open')
              .then(({ error }) => {
                if (error) console.error('Error updating position:', error);
              });

            return {
              ...position,
              current_price: currentPrice,
              pnl: pnl
            };
          })
        );

        setPositions(updatedPositions);
      } catch (error) {
        console.error('Error updating prices:', error);
      }
    };

    // Initial fetch
    updatePrices();

    // Live momentum updates every 3 seconds
    const intervalId = setInterval(updatePrices, 3000);

    return () => clearInterval(intervalId);
  }, [positions.length]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("created_at", { ascending: false });
    
    if (data) setUsers(data);
  };

  const fetchPositions = async () => {
    const { data } = await supabase
      .from("positions")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false });
    
    if (data) {
      // Fetch user profiles separately
      const userIds = data.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      // Merge profiles with positions
      const positionsWithProfiles = data.map(position => ({
        ...position,
        profiles: profiles?.find(p => p.id === position.user_id)
      }));
      
      setPositions(positionsWithProfiles as any);
    }
  };

  const fetchClosedPositions = async (userId: string) => {
    const { data } = await supabase
      .from("positions")
      .select("*")
      .eq("status", "closed")
      .eq("user_id", userId)
      .order("closed_at", { ascending: false });
    
    if (data) {
      // Fetch user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId)
        .maybeSingle();
      
      const positionsWithProfiles = data.map(position => ({
        ...position,
        profiles: profile || undefined
      }));
      
      setClosedPositions(positionsWithProfiles as any);
    }
  };

  const getEffectivePositionAmount = (position: Pick<Position, 'amount' | 'margin' | 'leverage' | 'entry_price'>) => {
    const rawAmount = Number(position.amount) || 0;
    const margin = Number(position.margin) || 0;
    const leverage = Number(position.leverage) || 0;
    const entryPrice = Number(position.entry_price) || 0;

    if (rawAmount <= 0) return 0;

    const inferredQuantity = margin > 0 && leverage > 0 && entryPrice > 0
      ? (margin * leverage) / entryPrice
      : 0;

    if (inferredQuantity > 0 && rawAmount > inferredQuantity * 20) {
      return inferredQuantity;
    }

    return rawAmount;
  };

  const calculatePnL = (position: Position) => {
    const quantity = getEffectivePositionAmount(position);
    if (position.position_type === 'long') {
      return (position.current_price - position.entry_price) * quantity;
    } else {
      return (position.entry_price - position.current_price) * quantity;
    }
  };

  // Get users with active trades
  const usersWithTrades: UserWithTrades[] = useMemo(() => {
    const userTradeMap = new Map<string, UserWithTrades>();
    
    positions.forEach(position => {
      const existing = userTradeMap.get(position.user_id);
      const pnl = calculatePnL(position);
      
      if (existing) {
        existing.tradeCount += 1;
        existing.totalPnL += pnl;
      } else {
        userTradeMap.set(position.user_id, {
          id: position.user_id,
          full_name: position.profiles?.full_name || 'Unknown',
          email: position.profiles?.email || '',
          tradeCount: 1,
          totalPnL: pnl
        });
      }
    });
    
    return Array.from(userTradeMap.values());
  }, [positions]);

  // Filter users by search
  const filteredUsers = usersWithTrades.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get trades for selected user with pagination
  const selectedUserTrades = viewingUserId 
    ? positions.filter(p => p.user_id === viewingUserId)
    : [];
  
  const totalPages = Math.ceil(selectedUserTrades.length / TRADES_PER_PAGE);
  const paginatedTrades = selectedUserTrades.slice(
    (currentPage - 1) * TRADES_PER_PAGE,
    currentPage * TRADES_PER_PAGE
  );

  const selectedUserInfo = usersWithTrades.find(u => u.id === viewingUserId);

  const handleOpenTrade = async () => {
    // Validate based on price mode and input mode
    if (!selectedUser || !symbol) {
      toast.error("Please select user and symbol");
      return;
    }

    if (priceMode === 'manual' && !entryPrice) {
      toast.error("Please enter entry price for manual mode");
      return;
    }

    if (inputMode === 'amount' && !amount) {
      toast.error("Please enter amount");
      return;
    }

    if (inputMode === 'lotSize' && !lotSize) {
      toast.error("Please enter lot size");
      return;
    }

    try {
      let price: number;
      let tradeAmount: number;

      if (priceMode === 'live') {
        // Fetch real-time market price based on asset type
        console.log('Fetching live market price for symbol:', symbol, 'asset type:', assetType);
        
        let priceData: any;
        let priceError: any;
        
        if (assetType === 'crypto') {
          // Fetch crypto prices
          const response = await supabase.functions.invoke('fetch-crypto-data');
          priceData = response.data;
          priceError = response.error;
          
          if (priceError) {
            console.error('Error fetching crypto price:', priceError);
            toast.error("Failed to fetch live market price: " + priceError.message);
            return;
          }

          if (!priceData || !priceData.cryptoData || !Array.isArray(priceData.cryptoData)) {
            console.error('Invalid crypto price data format:', priceData);
            toast.error("Invalid price data received");
            return;
          }

          const symbolData = priceData.cryptoData.find((coin: any) => {
            const coinSymbol = coin.symbol?.toUpperCase() || '';
            const searchSymbol = symbol.toUpperCase().trim();
            return coinSymbol === searchSymbol;
          });

          if (!symbolData || !symbolData.price) {
            console.error('Crypto symbol not found:', symbol);
            toast.error(`Symbol ${symbol} not found. Please check symbol name.`);
            return;
          }

          price = parseFloat(symbolData.price);
          
        } else if (assetType === 'commodities') {
          // Fetch commodities prices
          const response = await supabase.functions.invoke('fetch-commodities-data');
          priceData = response.data;
          priceError = response.error;
          
          if (priceError) {
            console.error('Error fetching commodities price:', priceError);
            toast.error("Failed to fetch live market price: " + priceError.message);
            return;
          }

          if (!priceData || !priceData.commoditiesData || !Array.isArray(priceData.commoditiesData)) {
            console.error('Invalid commodities price data format:', priceData);
            toast.error("Invalid price data received");
            return;
          }

          const symbolData = priceData.commoditiesData.find((commodity: any) => {
            const commoditySymbol = commodity.symbol?.toUpperCase() || '';
            const searchSymbol = symbol.toUpperCase().trim();
            return commoditySymbol === searchSymbol;
          });

          if (!symbolData || !symbolData.price) {
            console.error('Commodity symbol not found:', symbol);
            toast.error(`Symbol ${symbol} not found. Please check symbol name.`);
            return;
          }

          price = parseFloat(symbolData.price);
          
        } else if (assetType === 'forex') {
          // Fetch forex prices
          const response = await invokeForexData();
          priceData = response.data;
          priceError = response.error;
          
          if (priceError) {
            console.error('Error fetching forex price:', priceError);
            toast.error("Failed to fetch live market price: " + priceError.message);
            return;
          }

          if (!priceData || !priceData.forexData || !Array.isArray(priceData.forexData)) {
            console.error('Invalid forex price data format:', priceData);
            toast.error("Invalid price data received");
            return;
          }

          // For forex, match by the full pair name (EUR/USD) or just the base currency (EUR)
          const symbolData = priceData.forexData.find((forex: any) => {
            const forexName = forex.name?.toUpperCase() || '';
            const forexSymbol = forex.symbol?.toUpperCase() || '';
            const searchSymbol = symbol.toUpperCase().trim();
            return forexName === searchSymbol || forexSymbol === searchSymbol;
          });

          if (!symbolData || !symbolData.price) {
            console.error('Forex symbol not found:', symbol);
            toast.error(`Symbol ${symbol} not found. Please check symbol name.`);
            return;
          }

          price = parseFloat(symbolData.price);
          
        } else {
          toast.error("Invalid asset type selected");
          return;
        }

        console.log('Opening trade at live price:', price);
      } else {
        // Manual mode
        price = parseFloat(entryPrice);
        console.log('Opening trade at manual price:', price);
      }

      const lev = parseInt(leverage);
      let margin: number;
      let positionSize: number;
      
      if (inputMode === 'amount') {
        // Amount mode: margin = amount, calculate positionSize
        margin = parseFloat(amount);
        positionSize = (margin * lev) / price;
      } else {
        // Lot size mode: positionSize = lotSize, calculate margin
        positionSize = parseFloat(lotSize);
        margin = (positionSize * price) / lev;
      }

      // Check user wallet balance
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', selectedUser)
        .eq('currency', 'USD')
        .single();

      const currentBalance = wallet?.balance || 0;
      
      if (currentBalance < margin) {
        toast.error(`Insufficient balance. Required: $${margin.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`);
        return;
      }

      // Check for existing open position on same symbol + same direction for this user
      const { data: existingPosition, error: existingError } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', selectedUser)
        .eq('symbol', symbol.toUpperCase())
        .eq('position_type', positionType)
        .eq('status', 'open')
        .maybeSingle();

      if (existingError) {
        console.error('Error checking existing position:', existingError);
      }

      // Deduct margin from wallet
      await supabase
        .from('user_wallets')
        .update({ balance: currentBalance - margin })
        .eq('user_id', selectedUser)
        .eq('currency', 'USD');

      if (existingPosition) {
        // AVERAGE INTO EXISTING POSITION
        const oldAmount = Number(existingPosition.amount);
        const oldEntryPrice = Number(existingPosition.entry_price);
        const oldMargin = Number(existingPosition.margin);

        const newTotalAmount = oldAmount + positionSize;
        const newAvgEntryPrice = ((oldAmount * oldEntryPrice) + (positionSize * price)) / newTotalAmount;
        const newTotalMargin = oldMargin + margin;
        const newLeverage = Math.round((newTotalAmount * newAvgEntryPrice) / newTotalMargin);

        const { error: avgError } = await supabase
          .from('positions')
          .update({
            amount: newTotalAmount,
            entry_price: newAvgEntryPrice,
            current_price: price,
            margin: newTotalMargin,
            leverage: newLeverage,
            price_mode: priceMode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPosition.id)
          .eq('status', 'open');

        if (avgError) {
          // Rollback wallet deduction
          await supabase
            .from('user_wallets')
            .update({ balance: currentBalance })
            .eq('user_id', selectedUser)
            .eq('currency', 'USD');
          throw avgError;
        }

        // Record transaction
        await supabase.from('wallet_transactions').insert({
          user_id: selectedUser,
          type: 'trade',
          amount: -margin,
          currency: 'USD',
          status: 'Completed',
          reference_id: null
        });

        toast.success(`Averaged into existing ${positionType.toUpperCase()} position. New avg entry: $${newAvgEntryPrice.toFixed(2)}, Total margin: $${newTotalMargin.toFixed(2)}`);
      } else {
        // CREATE NEW POSITION
        const { error } = await supabase.from('positions').insert({
          user_id: selectedUser,
          symbol: symbol.toUpperCase(),
          position_type: positionType,
          amount: positionSize,
          entry_price: price,
          current_price: price,
          leverage: lev,
          margin: margin,
          status: 'open',
          price_mode: priceMode
        });

        if (error) {
          // Rollback wallet deduction
          await supabase
            .from('user_wallets')
            .update({ balance: currentBalance })
            .eq('user_id', selectedUser)
            .eq('currency', 'USD');
          throw error;
        }

        // Record transaction
        await supabase.from('wallet_transactions').insert({
          user_id: selectedUser,
          type: 'trade',
          amount: -margin,
          currency: 'USD',
          status: 'Completed',
          reference_id: null
        });

        toast.success(`Trade opened for user`);
      }

      setOpenTradeDialog(false);
      resetForm();
      fetchPositions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEditTrade = async () => {
    if (!selectedPosition || !entryPrice || !amount) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      // Guardrail: entry_price is locked while trade is in 'edited' mode.
      // Always use the stored entry_price for edited trades regardless of input.
      const isEditedLocked = selectedPosition.price_mode === 'edited';
      const newEntryPrice = isEditedLocked
        ? selectedPosition.entry_price
        : parseFloat(entryPrice);
      const newAmount = parseFloat(amount);
      const newMargin = (newAmount * newEntryPrice) / selectedPosition.leverage;

      // Calculate old and new margin difference
      const marginDiff = newMargin - selectedPosition.margin;

      // Get user wallet
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', selectedPosition.user_id)
        .eq('currency', 'USD')
        .single();

      const currentBalance = wallet?.balance || 0;

      // If margin increased, check if user has enough balance
      if (marginDiff > 0 && currentBalance < marginDiff) {
        toast.error(`Insufficient balance for margin increase. Required: $${marginDiff.toFixed(2)}`);
        return;
      }

      // Update wallet balance
      await supabase
        .from('user_wallets')
        .update({ balance: currentBalance - marginDiff })
        .eq('user_id', selectedPosition.user_id)
        .eq('currency', 'USD');

      // Update position
      const newCurrentPrice = currentPriceEdit ? parseFloat(currentPriceEdit) : newEntryPrice;
      const currentPriceChanged = newCurrentPrice !== selectedPosition.current_price;
      
      // If admin changed current price, set price_mode to 'edited' so it won't be overridden by live market
      const newPriceMode = currentPriceChanged ? 'edited' : selectedPosition.price_mode;
      
      // Calculate PnL based on the new current price
      const priceDiff = selectedPosition.position_type === 'long' 
        ? newCurrentPrice - newEntryPrice 
        : newEntryPrice - newCurrentPrice;
      const newPnl = priceDiff * newAmount;

      // Auto-activate momentum drift on edited trades:
      // Long → upward 1-5%, Short → downward 1-5% (favours trade direction)
      const isEdited = newPriceMode === 'edited';
      const driftPct = (1 + Math.random() * 4) / 100; // 0.01..0.05
      const direction: 'up' | 'down' = selectedPosition.position_type === 'long' ? 'up' : 'down';
      const momentumTarget = isEdited
        ? (direction === 'up' ? newCurrentPrice * (1 + driftPct) : newCurrentPrice * (1 - driftPct))
        : null;

      const previousMode = selectedPosition.price_mode ?? "live";
      const { error } = await supabase
        .from('positions')
        .update({
          amount: newAmount,
          entry_price: newEntryPrice,
          current_price: newCurrentPrice,
          margin: newMargin,
          pnl: newPnl,
          price_mode: newPriceMode,
          momentum_active: isEdited,
          momentum_direction: isEdited ? direction : null,
          momentum_target_price: momentumTarget,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', selectedPosition.id);

      if (error) {
        modeLogger.error("AdminTradeManagement.handleEditTrade", "db_update",
          `Edit trade failed: ${error.message}`,
          { position_id: selectedPosition.id, symbol: selectedPosition.symbol, price_mode: newPriceMode });
        throw error;
      }

      if (previousMode !== newPriceMode) {
        modeLogger.warn("AdminTradeManagement.handleEditTrade", "mode_transition",
          `${selectedPosition.symbol} ${previousMode} → ${newPriceMode}`,
          { position_id: selectedPosition.id, symbol: selectedPosition.symbol, price_mode: newPriceMode,
            data: { from: previousMode, to: newPriceMode, current_price: newCurrentPrice, pnl: newPnl } });
      } else {
        modeLogger.info("AdminTradeManagement.handleEditTrade", "db_update",
          `Edited trade saved (${newPriceMode})`,
          { position_id: selectedPosition.id, symbol: selectedPosition.symbol, price_mode: newPriceMode,
            data: { current_price: newCurrentPrice, pnl: newPnl, momentum_target: momentumTarget } });
      }

      toast.success("Trade updated successfully");
      setEditTradeDialog(false);
      setSelectedPosition(null);
      fetchPositions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCloseTrade = async (position: Position) => {
    try {
      // Use the current displayed PnL (which may have been edited by admin)
      // instead of recalculating from prices
      const pnl = position.pnl ?? calculatePnL(position);

      // Close position with the current PnL value
      await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          close_price: position.current_price,
          pnl: pnl
        })
        .eq('id', position.id);

      // Get wallet
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', position.user_id)
        .eq('currency', 'USD')
        .single();

      const currentBalance = wallet?.balance || 0;
      const finalAmount = position.margin + pnl;

      // Update wallet
      await supabase
        .from('user_wallets')
        .update({ balance: currentBalance + finalAmount })
        .eq('user_id', position.user_id)
        .eq('currency', 'USD');

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        user_id: position.user_id,
        type: 'trade',
        amount: finalAmount,
        currency: 'USD',
        status: 'Completed',
        reference_id: position.id
      });

      toast.success(`Position closed: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} PnL`);
      fetchPositions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // State guardrail: only valid path to restart live feed on an edited trade.
  // Clears momentum metadata atomically and gates on price_mode='edited' so it
  // never mutates a trade that's already live or has been changed concurrently.
  const handleResetToLive = async (position: Position) => {
    if (position.price_mode !== 'edited') {
      toast.error("This trade is not in Edited mode");
      return;
    }
    const ok = window.confirm(
      `Reset ${position.symbol} to LIVE feed?\n\n` +
      `• Cron drift will stop\n` +
      `• Live market price will resume on next tick\n` +
      `• PnL will recalculate from live price`
    );
    if (!ok) return;

    try {
      const { error, count } = await (supabase
        .from('positions')
        .update({
          price_mode: 'live',
          momentum_active: false,
          momentum_target_price: null,
          momentum_direction: null,
          updated_at: new Date().toISOString(),
        }, { count: 'exact' }) as any)
        .eq('id', position.id)
        .eq('status', 'open')
        .eq('price_mode', 'edited'); // guard: prevents racing with concurrent toggles

      if (error) {
        modeLogger.error("AdminTradeManagement.handleResetToLive", "reset_to_live",
          `Reset failed: ${error.message}`,
          { position_id: position.id, symbol: position.symbol, price_mode: "edited" });
        throw error;
      }
      if (!count) {
        modeLogger.warn("AdminTradeManagement.handleResetToLive", "db_guard_block",
          `Reset blocked — row was no longer in edited mode`,
          { position_id: position.id, symbol: position.symbol, price_mode: position.price_mode });
        toast.error("Trade is no longer in Edited mode — refresh the table");
        fetchPositions();
        return;
      }
      modeLogger.info("AdminTradeManagement.handleResetToLive", "mode_transition",
        `${position.symbol} edited → live (manual reset)`,
        { position_id: position.id, symbol: position.symbol, price_mode: "live",
          data: { from: "edited", to: "live" } });
      toast.success(`${position.symbol} reset to LIVE feed`);
      fetchPositions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openEditDialog = (position: Position) => {
    setSelectedPosition(position);
    setAmount(position.amount.toString());
    setEntryPrice(position.entry_price.toString());
    setCurrentPriceEdit(position.current_price.toString());
    setEditTradeDialog(true);
  };

  const resetForm = () => {
    setSelectedUser("");
    setSymbol("");
    setPositionType("long");
    setAmount("");
    setLotSize("");
    setInputMode("amount");
    setEntryPrice("");
    setLeverage("1");
    setPriceMode("live");
    setSelectedUserBalance(null);
    setFetchedPrice(null);
  };

  const handleSymbolChange = (value: string) => {
    setSymbol(value);
  };

  const handleAdjustPnl = async () => {
    if (!adjustPnlPositionId || !targetPnlPercent) {
      toast.error("Please enter target PnL%");
      return;
    }

    await adjustPnlForPosition(adjustPnlPositionId, parseFloat(targetPnlPercent));
    setAdjustPnlPositionId(null);
    setTargetPnlPercent("");
  };

  const adjustPnlForPosition = async (positionId: string, pnlPercent: number) => {
    const position = positionsRef.current.find(p => p.id === positionId);
    if (!position) return;

    try {
      const targetPnl = (pnlPercent / 100) * position.margin;
      let newCurrentPrice: number;
      const quantity = getEffectivePositionAmount(position);

      if (position.position_type === 'long') {
        newCurrentPrice = position.entry_price + (quantity > 0 ? targetPnl / quantity : 0);
      } else {
        newCurrentPrice = position.entry_price - (quantity > 0 ? targetPnl / quantity : 0);
      }

      // CRITICAL: Store the base PnL in the ref - this is the admin-set value that won't change
      basePnlRef.current[positionId] = targetPnl;

      // Update local state immediately so UI reflects the change
      // Mark as 'edited' so it won't follow live market prices anymore
      setPositions(prev => prev.map(p => 
        p.id === positionId 
          ? { ...p, current_price: newCurrentPrice, pnl: targetPnl, price_mode: 'edited' }
          : p
      ));

      // Update database in background - mark as 'edited' price mode + activate momentum
      const driftPct = (1 + Math.random() * 4) / 100; // 0.01..0.05
      const direction: 'up' | 'down' = position.position_type === 'long' ? 'up' : 'down';
      const momentumTarget = direction === 'up'
        ? newCurrentPrice * (1 + driftPct)
        : newCurrentPrice * (1 - driftPct);

      const { error } = await supabase
        .from('positions')
        .update({
          current_price: newCurrentPrice,
          pnl: targetPnl,
          price_mode: 'edited',
          momentum_active: true,
          momentum_direction: direction,
          momentum_target_price: momentumTarget,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', positionId);

      if (error) {
        // Revert local state and ref on error
        delete basePnlRef.current[positionId];
        fetchPositions();
        throw error;
      }

      toast.success(`PnL adjusted to ${pnlPercent.toFixed(2)}%`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewUserTrades = (userId: string) => {
    setViewingUserId(userId);
    setCurrentPage(1);
    setTradeViewTab('open');
    fetchClosedPositions(userId);
  };

  const handleBackToUsers = () => {
    setViewingUserId(null);
    setCurrentPage(1);
    setTradeViewTab('open');
    setClosedPositions([]);
  };

  const handleTabChange = (tab: string) => {
    setTradeViewTab(tab as 'open' | 'closed');
    setCurrentPage(1);
  };

  // Get trades for display based on active tab
  const displayTrades = tradeViewTab === 'open' ? selectedUserTrades : closedPositions;
  const displayTotalPages = Math.ceil(displayTrades.length / TRADES_PER_PAGE);
  const displayPaginatedTrades = displayTrades.slice(
    (currentPage - 1) * TRADES_PER_PAGE,
    currentPage * TRADES_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trade Management</h2>
        <Button onClick={() => setOpenTradeDialog(true)}>
          Open Trade for User
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by user name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {!viewingUserId ? (
        // Users List View
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users with Active Trades ({filteredUsers.length})
          </h3>
          
          {filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery ? "No users found matching your search" : "No active trades"}
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{user.tradeCount}</div>
                      <div className="text-xs text-muted-foreground">Trades</div>
                    </div>
                    <div className="text-center min-w-[100px]">
                      <div className={`text-lg font-semibold ${user.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {user.totalPnL >= 0 ? '+' : ''}${user.totalPnL.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total PnL</div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewUserTrades(user.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Trades
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        // User's Trades View
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleBackToUsers}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div>
                <h3 className="text-lg font-semibold">{selectedUserInfo?.full_name}'s Trades</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedUserTrades.length} open • {closedPositions.length} closed
                </p>
              </div>
            </div>
          </div>

          <Tabs value={tradeViewTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="open" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Open Trades ({selectedUserTrades.length})
              </TabsTrigger>
              <TabsTrigger value="closed" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Trade History ({closedPositions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              {selectedUserTrades.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No open trades</p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-2 px-2"><Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Entry Price</TableHead>
                        <TableHead>Current Price</TableHead>
                        <TableHead>Leverage</TableHead>
                        <TableHead>PnL</TableHead>
                        <TableHead>PnL %</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTrades.map((position) => {
                        // Use stored PnL for edited/manual trades, calculate only for live trades
                        const pnl = (position.price_mode === 'edited' || position.price_mode === 'manual') && position.pnl !== null && position.pnl !== undefined
                          ? position.pnl
                          : calculatePnL(position);
                        const isProfit = pnl >= 0;
                        const pnlPercent = (pnl / position.margin) * 100;
                        
                        return (
                          <TableRow key={position.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {position.symbol}
                                <Badge 
                                  variant={position.price_mode === 'edited' ? 'destructive' : position.price_mode === 'manual' ? 'secondary' : 'outline'}
                                  className={`text-[10px] px-1.5 py-0 ${
                                    position.price_mode === 'edited' 
                                      ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' 
                                      : position.price_mode === 'manual' 
                                        ? 'bg-purple-500/20 text-purple-500 border-purple-500/30' 
                                        : 'bg-green-500/20 text-green-500 border-green-500/30'
                                  }`}
                                >
                                  {position.price_mode === 'edited' ? 'Edited' : position.price_mode === 'manual' ? 'Manual' : 'Live'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 ${position.position_type === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                                {position.position_type === 'long' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                {position.position_type.toUpperCase()}
                              </div>
                            </TableCell>
                            <TableCell>{position.amount}</TableCell>
                            <TableCell>${position.entry_price.toFixed(2)}</TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 transition-all duration-300 ${
                                priceChanges[position.id]?.flash 
                                  ? priceChanges[position.id].direction === 'up' 
                                    ? 'text-green-500 animate-pulse' 
                                    : 'text-red-500 animate-pulse'
                                  : ''
                              }`}>
                                <span className={`px-2 py-1 rounded transition-all duration-300 ${
                                  priceChanges[position.id]?.flash
                                    ? priceChanges[position.id].direction === 'up'
                                      ? 'bg-green-500/20'
                                      : 'bg-red-500/20'
                                    : ''
                                }`}>
                                  ${position.current_price.toFixed(2)}
                                </span>
                                {priceChanges[position.id]?.direction === 'up' && (
                                  <ArrowUp className="h-4 w-4 text-green-500" />
                                )}
                                {priceChanges[position.id]?.direction === 'down' && (
                                  <ArrowDown className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{position.leverage}x</TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 transition-all duration-300 ${
                                priceChanges[position.id]?.flash 
                                  ? 'animate-pulse'
                                  : ''
                              } ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                <span className={`px-2 py-1 rounded ${
                                  priceChanges[position.id]?.flash
                                    ? isProfit
                                      ? 'bg-green-500/20'
                                      : 'bg-red-500/20'
                                    : ''
                                }`}>
                                  {isProfit ? '+' : ''}${pnl.toFixed(2)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => adjustPnlForPosition(position.id, pnlPercent - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                
                                {adjustPnlPositionId === position.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      placeholder="PnL %"
                                      value={targetPnlPercent}
                                      onChange={(e) => setTargetPnlPercent(e.target.value)}
                                      className="w-16 h-7 text-xs"
                                    />
                                    <Button size="sm" className="h-7 px-2" onClick={handleAdjustPnl}>OK</Button>
                                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setAdjustPnlPositionId(null)}>X</Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setAdjustPnlPositionId(position.id);
                                      setTargetPnlPercent(pnlPercent.toFixed(2));
                                    }}
                                    className={`font-semibold min-w-[60px] text-center ${isProfit ? 'text-green-500' : 'text-red-500'}`}
                                  >
                                    {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                                  </button>
                                )}
                                
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => adjustPnlForPosition(position.id, pnlPercent + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {position.price_mode === 'edited' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 border-orange-500/40 text-orange-500 hover:bg-orange-500/10"
                                    title="Reset to Live feed (only valid path to restart live updates)"
                                    onClick={() => handleResetToLive(position)}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    <span className="text-xs">Live</span>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(position)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCloseTrade(position)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table></div>

                  {/* Pagination for open trades */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1} to {Math.min(currentPage * TRADES_PER_PAGE, selectedUserTrades.length)} of {selectedUserTrades.length} trades
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm px-3">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="closed">
              {closedPositions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No closed trades</p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-2 px-2"><Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Entry Price</TableHead>
                        <TableHead>Close Price</TableHead>
                        <TableHead>Leverage</TableHead>
                        <TableHead>Final PnL</TableHead>
                        <TableHead>Closed At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayPaginatedTrades.map((position) => {
                        const pnl = position.pnl || 0;
                        const isProfit = pnl >= 0;
                        const pnlPercent = (pnl / position.margin) * 100;
                        
                        return (
                          <TableRow key={position.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {position.symbol}
                                <Badge 
                                  variant={position.price_mode === 'edited' ? 'destructive' : position.price_mode === 'manual' ? 'secondary' : 'outline'}
                                  className={`text-[10px] px-1.5 py-0 ${
                                    position.price_mode === 'edited' 
                                      ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' 
                                      : position.price_mode === 'manual' 
                                        ? 'bg-purple-500/20 text-purple-500 border-purple-500/30' 
                                        : 'bg-green-500/20 text-green-500 border-green-500/30'
                                  }`}
                                >
                                  {position.price_mode === 'edited' ? 'Edited' : position.price_mode === 'manual' ? 'Manual' : 'Live'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 ${position.position_type === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                                {position.position_type === 'long' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                {position.position_type.toUpperCase()}
                              </div>
                            </TableCell>
                            <TableCell>{position.amount}</TableCell>
                            <TableCell>${position.entry_price.toFixed(2)}</TableCell>
                            <TableCell>${(position.close_price || position.current_price).toFixed(2)}</TableCell>
                            <TableCell>{position.leverage}x</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className={`font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                  {isProfit ? '+' : ''}${pnl.toFixed(2)}
                                </span>
                                <span className={`text-xs ${isProfit ? 'text-green-500/70' : 'text-red-500/70'}`}>
                                  {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {position.closed_at && (
                                  <>
                                    <div>{new Date(position.closed_at).toLocaleDateString()}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(position.closed_at).toLocaleTimeString()}
                                    </div>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table></div>

                  {/* Pagination for closed trades */}
                  {displayTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1} to {Math.min(currentPage * TRADES_PER_PAGE, closedPositions.length)} of {closedPositions.length} trades
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm px-3">
                          Page {currentPage} of {displayTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(displayTotalPages, p + 1))}
                          disabled={currentPage === displayTotalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      )}

      {/* Open Trade Dialog */}
      <Dialog open={openTradeDialog} onOpenChange={(open) => {
        setOpenTradeDialog(open);
        if (!open) {
          setUserSearchQuery("");
          setSelectedLetter(null);
          setSymbol("");
          setAmount("");
          setLotSize("");
          setEntryPrice("");
          setFetchedPrice(null);
          setInputMode("amount");
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Open Trade for User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Price Mode</Label>
              <Select value={priceMode} onValueChange={(v) => setPriceMode(v as 'live' | 'manual')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live Market Price</SelectItem>
                  <SelectItem value="manual">Manual Entry Price (±5%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Select User</Label>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              
              {/* A-Z Quick Filter */}
              <div className="flex flex-wrap gap-1 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedLetter === null ? "default" : "outline"}
                  className="h-6 w-8 p-0 text-xs"
                  onClick={() => setSelectedLetter(null)}
                >
                  All
                </Button>
                {availableLetters.map((letter) => (
                  <Button
                    key={letter}
                    type="button"
                    size="sm"
                    variant={selectedLetter === letter ? "default" : "outline"}
                    className="h-6 w-6 p-0 text-xs"
                    onClick={() => setSelectedLetter(letter)}
                  >
                    {letter}
                  </Button>
                ))}
              </div>
              
              <Select value={selectedUser} onValueChange={handleUserSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] overflow-y-auto bg-popover z-50">
                  {filteredUsersForDialog.length === 0 ? (
                    <div className="py-4 text-center text-muted-foreground text-sm">
                      No users found
                    </div>
                  ) : (
                    filteredUsersForDialog.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || 'No Name'} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedUser && selectedUserBalance !== null && (
                <p className="text-sm text-muted-foreground mt-1">
                  Available Balance: <span className="font-semibold text-green-500">${selectedUserBalance.toFixed(2)}</span>
                </p>
              )}
            </div>

            <div>
              <Label>Asset Type</Label>
              <Select value={assetType} onValueChange={(v) => {
                setAssetType(v as 'crypto' | 'forex' | 'commodities');
                setSymbol("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crypto">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      Crypto
                    </div>
                  </SelectItem>
                  <SelectItem value="forex">
                    <div className="flex items-center gap-2">
                      <span>💱</span>
                      Forex
                    </div>
                  </SelectItem>
                  <SelectItem value="commodities">
                    <div className="flex items-center gap-2">
                      <span>🥇</span>
                      Commodities
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Select Asset</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {availableAssets.map((asset) => (
                    <SelectItem key={asset.symbol} value={asset.symbol}>
                      {asset.name} ({asset.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Position Type</Label>
              <Select value={positionType} onValueChange={(v) => setPositionType(v as 'long' | 'short')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long (Buy)</SelectItem>
                  <SelectItem value="short">Short (Sell)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {priceMode === 'manual' && (
              <div>
                <Label>Entry Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label>Input Mode</Label>
              <Select value={inputMode} onValueChange={(v) => {
                setInputMode(v as 'amount' | 'lotSize');
                setAmount("");
                setLotSize("");
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Amount (USD)</SelectItem>
                  <SelectItem value="lotSize">Lot Size (Units)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {inputMode === 'amount' ? (
              <div>
                <Label>Amount (Investment in USD)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <Label>Lot Size (Units of Asset)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                />
                {fetchedPrice && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current Price: <span className="font-semibold text-primary">${fetchedPrice.toFixed(4)}</span>
                  </p>
                )}
              </div>
            )}

            {calculatedValues !== null && (
              <div className="p-2 bg-muted/50 rounded-lg border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margin Required:</span>
                  <span className="font-semibold text-primary">${calculatedValues.margin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Position Size ({leverage}x):</span>
                  <span className="font-semibold">${calculatedValues.positionValue.toFixed(2)}</span>
                </div>
                {calculatedValues.lotSize > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Lot Size (Units):</span>
                    <span className="font-semibold">{calculatedValues.lotSize.toFixed(6)}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Leverage</Label>
              <Select value={leverage} onValueChange={setLeverage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 5, 10, 20, 50, 100].map((lev) => (
                    <SelectItem key={lev} value={lev.toString()}>
                      {lev}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {priceMode === 'live' && (
              <p className="text-sm text-muted-foreground">
                Trade will open at current live market price and follow real-time market movements.
              </p>
            )}
            {priceMode === 'manual' && (
              <p className="text-sm text-muted-foreground">
                Trade will fluctuate ±5% around the manual entry price you specify.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleOpenTrade}>
              Open Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Trade Dialog */}
      <Dialog open={editTradeDialog} onOpenChange={setEditTradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Trade
              {selectedPosition?.price_mode === 'edited' && (
                <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">Edited</Badge>
              )}
              {selectedPosition?.price_mode === 'manual' && (
                <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Manual</Badge>
              )}
              {selectedPosition?.price_mode === 'live' && (
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Live</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPosition?.price_mode === 'edited' && (
              <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-3 space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-orange-500">Live feed is paused</div>
                    <div className="text-xs text-muted-foreground">
                      This trade is on controlled drift. Entry price is locked. To resume live market price,
                      use the button below — that's the only safe way to restart the live feed.
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-500/40 text-orange-500 hover:bg-orange-500/20 w-full"
                  onClick={() => {
                    if (selectedPosition) {
                      setEditTradeDialog(false);
                      handleResetToLive(selectedPosition);
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Live feed
                </Button>
              </div>
            )}

            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Entry Price
                {selectedPosition?.price_mode === 'edited' && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </Label>
              <Input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                disabled={selectedPosition?.price_mode === 'edited'}
              />
              {selectedPosition?.price_mode === 'edited' && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Locked while in Edited mode — reset to Live first to change.
                </p>
              )}
            </div>
            <div>
              <Label>Current Price</Label>
              <Input
                type="number"
                value={currentPriceEdit}
                onChange={(e) => setCurrentPriceEdit(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Note: Editing current price keeps the trade in Edited mode and triggers controlled drift.
              Entry price changes are blocked on Edited trades to preserve PnL math integrity.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTrade}>
              Update Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
