import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invokeForexData } from "@/lib/forexCache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, X, RefreshCcw, ArrowUp, ArrowDown, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import BottomNav from "@/components/BottomNav";
import { isCommoditySymbol, isForexSymbol } from "@/lib/marketSymbols";

interface Position {
  id: string;
  symbol: string;
  position_type: 'long' | 'short';
  amount: number;
  entry_price: number;
  current_price: number;
  leverage: number;
  margin: number;
  pnl: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
  close_price?: number;
  price_mode?: string;
  stop_loss?: number | null;
  take_profit?: number | null;
}

const PRICE_POLL_INTERVAL_MS = 3000;
const PRICE_FLASH_DURATION_MS = 1200;
const MARKET_SETTINGS_CACHE_MS = 30000;

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

const formatMarketPrice = (value: number) => {
  const safeValue = Number(value) || 0;

  if (safeValue >= 1000) return safeValue.toFixed(2);
  if (safeValue >= 1) return safeValue.toFixed(4);
  if (safeValue >= 0.01) return safeValue.toFixed(6);
  return safeValue.toFixed(8);
};

const formatLivePnl = (value: number) => {
  const safeValue = Number(value) || 0;
  const absoluteValue = Math.abs(safeValue);

  if (absoluteValue >= 1) return safeValue.toFixed(2);
  if (absoluteValue >= 0.01) return safeValue.toFixed(4);
  return safeValue.toFixed(6);
};

const Positions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [closePositionId, setClosePositionId] = useState<string | null>(null);
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [closedSuccessId, setClosedSuccessId] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<Record<string, { direction: 'up' | 'down' | 'none'; flash: boolean }>>({});
  const previousPricesRef = useRef<Record<string, number>>({});
  const positionsRef = useRef<Position[]>([]);
  // Store base PnL for edited trades (admin-set values that don't change)
  const basePnlRef = useRef<Record<string, number>>({});
  const isPriceUpdateInFlightRef = useRef(false);
  const marketMomentumSettingsRef = useRef({
    forexMomentumEnabled: true,
    commoditiesMomentumEnabled: true,
    fetchedAt: 0,
  });
  // Refs to track closing state without causing useEffect rerenders
  const closingIdRef = useRef<string | null>(null);
  const closedSuccessIdRef = useRef<string | null>(null);
  // Track permanently closed positions to prevent re-adding during price updates
  const permanentlyClosedIdsRef = useRef<Set<string>>(new Set());
  
  // Keep refs in sync with state
  useEffect(() => {
    positionsRef.current = openPositions;
    // Initialize basePnlRef for edited trades from database values
    openPositions.forEach(pos => {
      if (pos.price_mode === 'edited' && basePnlRef.current[pos.id] === undefined) {
        basePnlRef.current[pos.id] = pos.pnl || 0;
      }
    });
  }, [openPositions]);

  // Sync closing state refs
  useEffect(() => {
    closingIdRef.current = closingPositionId;
  }, [closingPositionId]);

  useEffect(() => {
    closedSuccessIdRef.current = closedSuccessId;
  }, [closedSuccessId]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchPositions();
  }, [user, navigate]);

  // Real-time price updates for open positions
  const hasOpenPositions = openPositions.length > 0;

  useEffect(() => {
    if (!user || !hasOpenPositions) return;

    const getMarketMomentumSettings = async () => {
      const now = Date.now();
      if (now - marketMomentumSettingsRef.current.fetchedAt < MARKET_SETTINGS_CACHE_MS) {
        return marketMomentumSettingsRef.current;
      }

      try {
        const { data: settingsData } = await supabase
          .from("payment_settings")
          .select("setting_key, setting_value")
          .in("setting_key", ["forex_momentum_enabled", "commodities_momentum_enabled"]);

        const nextSettings = {
          forexMomentumEnabled: true,
          commoditiesMomentumEnabled: true,
          fetchedAt: now,
        };

        if (settingsData) {
          settingsData.forEach((s) => {
            if (s.setting_key === "forex_momentum_enabled") nextSettings.forexMomentumEnabled = s.setting_value !== "false";
            if (s.setting_key === "commodities_momentum_enabled") nextSettings.commoditiesMomentumEnabled = s.setting_value !== "false";
          });
        }

        marketMomentumSettingsRef.current = nextSettings;
      } catch (err) {
        console.error("Error fetching momentum settings:", err);
      }

      return marketMomentumSettingsRef.current;
    };

    const updatePrices = async () => {
      if (isPriceUpdateInFlightRef.current) return;
      isPriceUpdateInFlightRef.current = true;

      try {
        const currentPositions = positionsRef.current.filter(
          (p) => p.status === "open" && !permanentlyClosedIdsRef.current.has(p.id)
        );

        if (currentPositions.length === 0) return;

        // Check if it's weekend (Saturday=6, Sunday=0)
        const today = new Date().getDay();
        const isWeekend = today === 0 || today === 6;

        const { forexMomentumEnabled, commoditiesMomentumEnabled } = await getMarketMomentumSettings();

        const livePositions = currentPositions.filter(
          (p) => p.price_mode !== "manual" && p.price_mode !== "edited"
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
            ? supabase.functions.invoke("fetch-crypto-data", { body: { symbols: cryptoSymbols } })
            : Promise.resolve({ data: null, error: null }),
          livePositions.some((p) => isForexSymbol(p.symbol))
            ? invokeForexData()
            : Promise.resolve({ data: null, error: null }),
          livePositions.some((p) => isCommoditySymbol(p.symbol))
            ? supabase.functions.invoke("fetch-commodities-data")
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
          forexResponse.data.forexData.forEach((fx: any) => {
            const price = parseFloat(fx.price);
            if (Number.isNaN(price) || price <= 0) return;

            const symbolKey = (fx.symbol || "").toUpperCase();
            const nameKey = (fx.name || "").toUpperCase();
            if (symbolKey) forexPrices[symbolKey] = price;
            if (nameKey) forexPrices[nameKey] = price;
          });
        }

        const commodityPrices: Record<string, number> = {};
        if (!commoditiesResponse.error && commoditiesResponse.data?.commoditiesData) {
          commoditiesResponse.data.commoditiesData.forEach((commodity: any) => {
            const key = (commodity.symbol || "").toUpperCase();
            const price = parseFloat(commodity.price);
            if (key && !Number.isNaN(price) && price > 0) {
              commodityPrices[key] = price;
            }
          });
        }

        const autoCloseQueue: Array<{ position: Position; reason: "stop_loss" | "take_profit" }> = [];

        const updatedPositions = currentPositions.map((position) => {
          let currentPrice = position.current_price;
          let pnl = position.pnl || 0;
          const quantity = getEffectivePositionAmount(position);
          const symbol = position.symbol.toUpperCase();
          const isForex = isForexSymbol(symbol);
          const isCommodity = isCommoditySymbol(symbol);

          const isMarketFrozen =
            (isForex && (isWeekend || !forexMomentumEnabled)) ||
            (isCommodity && (isWeekend || !commoditiesMomentumEnabled));

          if (position.price_mode === "edited") {
            if (isMarketFrozen) {
              return { ...position };
            }

            if (basePnlRef.current[position.id] === undefined) {
              basePnlRef.current[position.id] = position.pnl || 0;
            }

            const basePnl = basePnlRef.current[position.id];
            const basePnlPercent = position.margin > 0 ? (basePnl / position.margin) * 100 : 0;
            // Small slow momentum: 0.05-0.3% drift in PnL direction
            const momentumOffset = Math.random() * 0.25 + 0.05;
            const adjustedPnlPercent = basePnl >= 0
              ? basePnlPercent + momentumOffset
              : basePnlPercent - momentumOffset;

            pnl = (adjustedPnlPercent / 100) * position.margin;
            currentPrice = position.position_type === "long"
              ? position.entry_price + (quantity > 0 ? pnl / quantity : 0)
              : position.entry_price - (quantity > 0 ? pnl / quantity : 0);

            currentPrice = Math.max(0.0001, currentPrice);
          } else if (position.price_mode === "manual") {
            if (isMarketFrozen) {
              return { ...position };
            }

            const randomPercent = (Math.random() * 4 + 1) * (Math.random() > 0.5 ? 1 : -1);
            currentPrice = position.entry_price * (1 + randomPercent / 100);
          } else {
            if (isMarketFrozen) {
              return { ...position };
            }

            if (isForex) {
              currentPrice = forexPrices[symbol] || currentPrice;
            } else if (isCommodity) {
              currentPrice = commodityPrices[symbol] || currentPrice;
            } else {
              currentPrice = cryptoPrices[symbol] || currentPrice;
            }

            if (currentPrice <= 0) {
              return { ...position };
            }
          }

          const previousPrice = previousPricesRef.current[position.id];
          if (previousPrice !== undefined && previousPrice !== currentPrice) {
            const direction = currentPrice > previousPrice ? "up" : "down";
            setPriceChanges((prev) => ({ ...prev, [position.id]: { direction, flash: true } }));
            setTimeout(() => {
              setPriceChanges((prev) => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
            }, PRICE_FLASH_DURATION_MS);
          }
          previousPricesRef.current[position.id] = currentPrice;

          pnl =
            position.position_type === "long"
              ? (currentPrice - position.entry_price) * quantity
              : (position.entry_price - currentPrice) * quantity;

          if (position.stop_loss && !permanentlyClosedIdsRef.current.has(position.id)) {
            const hitStopLoss =
              (position.position_type === "long" && currentPrice <= position.stop_loss) ||
              (position.position_type === "short" && currentPrice >= position.stop_loss);
            if (hitStopLoss) {
              autoCloseQueue.push({ position: { ...position, current_price: currentPrice, pnl }, reason: "stop_loss" });
            }
          }

          if (position.take_profit && !permanentlyClosedIdsRef.current.has(position.id)) {
            const hitTakeProfit =
              (position.position_type === "long" && currentPrice >= position.take_profit) ||
              (position.position_type === "short" && currentPrice <= position.take_profit);
            if (hitTakeProfit) {
              autoCloseQueue.push({ position: { ...position, current_price: currentPrice, pnl }, reason: "take_profit" });
            }
          }

          if (position.price_mode !== "edited") {
            supabase
              .from("positions")
              .update({
                current_price: currentPrice,
                pnl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", position.id)
              .eq("status", "open")
              .then(({ error }) => {
                if (error) console.error("Error updating position:", error);
              });
          }

          return {
            ...position,
            current_price: currentPrice,
            pnl,
          };
        });

        setOpenPositions(updatedPositions);

        autoCloseQueue.forEach(({ position, reason }) => {
          handleAutoClose(position, reason);
        });

        // Check and execute pending limit orders
        try {
          const { data: limitOrders } = await supabase
            .from('limit_orders')
            .select('*')
            .eq('user_id', user?.id)
            .eq('status', 'pending' as any);

          if (limitOrders && limitOrders.length > 0) {
            for (const order of limitOrders) {
              const sym = order.symbol.toUpperCase();
              const isForex = isForexSymbol(sym);
              const isCommodity = isCommoditySymbol(sym);
              
              let marketPrice = 0;
              if (isForex) {
                marketPrice = forexPrices[sym] || 0;
              } else if (isCommodity) {
                marketPrice = commodityPrices[sym] || 0;
              } else {
                marketPrice = cryptoPrices[sym] || 0;
              }

              if (marketPrice <= 0) continue;

              // Check if limit price is reached
              const shouldExecute = 
                (order.position_type === 'long' && marketPrice <= order.limit_price) ||
                (order.position_type === 'short' && marketPrice >= order.limit_price);

              if (shouldExecute) {
                await executeLimitOrder(order, marketPrice);
              }
            }
          }
        } catch (limitErr) {
          console.error('Error checking limit orders:', limitErr);
        }
      } catch (error) {
        console.error("Error updating position prices:", error);
      } finally {
        isPriceUpdateInFlightRef.current = false;
      }
    };

    updatePrices();
    const intervalId = setInterval(updatePrices, PRICE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [user, hasOpenPositions]);

  // Subscribe to real-time updates for position changes (when admin edits a trade)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('positions-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'positions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedPosition = payload.new as Position;
          console.log('Position updated via realtime:', updatedPosition.id, 'status:', updatedPosition.status, 'price_mode:', updatedPosition.price_mode);
          
          // If position was closed, move it from open to closed
          if (updatedPosition.status === 'closed') {
            // Remove from open positions
            setOpenPositions(prev => prev.filter(p => p.id !== updatedPosition.id));
            // Add to closed positions (avoid duplicates)
            setClosedPositions(prev => {
              const exists = prev.some(p => p.id === updatedPosition.id);
              if (exists) {
                return prev.map(p => p.id === updatedPosition.id ? updatedPosition : p);
              }
              return [updatedPosition, ...prev];
            });
            // Clean up refs
            delete previousPricesRef.current[updatedPosition.id];
            delete basePnlRef.current[updatedPosition.id];
            return;
          }
          
          // If admin edited this trade, update the basePnlRef with the new base value
          if (updatedPosition.price_mode === 'edited') {
            basePnlRef.current[updatedPosition.id] = updatedPosition.pnl || 0;
          }
          
          // Update the position in state with new data from database (only if still open)
          setOpenPositions(prev => 
            prev.map(p => 
              p.id === updatedPosition.id 
                ? { ...p, ...updatedPosition }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Execute a limit order when price target is reached
  const executeLimitOrder = async (order: any, marketPrice: number) => {
    try {
      const entryPrice = order.limit_price;
      let usdAmount: number;
      let assetQuantity: number;
      let margin: number;

      if (order.input_mode === 'amount') {
        usdAmount = order.amount || 0;
        assetQuantity = usdAmount / entryPrice;
        margin = usdAmount / order.leverage;
      } else {
        assetQuantity = order.lot_size || 0;
        usdAmount = assetQuantity * entryPrice;
        margin = (assetQuantity * entryPrice) / order.leverage;
      }

      if (assetQuantity <= 0 || margin <= 0) return;

      // Check wallet balance
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', order.user_id)
        .eq('currency', 'USD')
        .maybeSingle();

      const currentBalance = wallet?.balance || 0;
      if (currentBalance < margin) {
        // Mark as cancelled due to insufficient balance
        await supabase
          .from('limit_orders')
          .update({ status: 'cancelled' as any, updated_at: new Date().toISOString() })
          .eq('id', order.id);
        toast.error(`Limit order for ${order.symbol} cancelled - insufficient balance`);
        return;
      }

      // Deduct margin
      await supabase
        .from('user_wallets')
        .update({ balance: currentBalance - margin })
        .eq('user_id', order.user_id)
        .eq('currency', 'USD');

      // Check for existing position to average into
      const { data: existingPosition } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', order.user_id)
        .eq('symbol', order.symbol)
        .eq('position_type', order.position_type)
        .eq('status', 'open')
        .maybeSingle();

      if (existingPosition) {
        const oldAmount = Number(existingPosition.amount);
        const oldEntryPrice = Number(existingPosition.entry_price);
        const oldMargin = Number(existingPosition.margin);
        const newTotalAmount = oldAmount + assetQuantity;
        const newAvgEntryPrice = ((oldAmount * oldEntryPrice) + (assetQuantity * entryPrice)) / newTotalAmount;
        const newTotalMargin = oldMargin + margin;
        const newLeverage = Math.round((newTotalAmount * newAvgEntryPrice) / newTotalMargin);

        await supabase
          .from('positions')
          .update({
            amount: newTotalAmount,
            entry_price: newAvgEntryPrice,
            current_price: marketPrice,
            margin: newTotalMargin,
            leverage: newLeverage,
            stop_loss: order.stop_loss ?? existingPosition.stop_loss,
            take_profit: order.take_profit ?? existingPosition.take_profit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPosition.id);
      } else {
        await supabase.from('positions').insert({
          user_id: order.user_id,
          symbol: order.symbol,
          position_type: order.position_type,
          amount: assetQuantity,
          entry_price: entryPrice,
          current_price: marketPrice,
          leverage: order.leverage,
          margin: margin,
          status: 'open',
          stop_loss: order.stop_loss,
          take_profit: order.take_profit,
        });
      }

      // Record transaction
      await supabase.from('wallet_transactions').insert({
        user_id: order.user_id,
        type: 'trade',
        amount: margin,
        currency: 'USD',
        status: 'Completed',
        reference_id: null,
      });

      // Mark limit order as executed
      await supabase
        .from('limit_orders')
        .update({ status: 'executed' as any, executed_at: new Date().toISOString() })
        .eq('id', order.id);

      toast.success(`Limit ${order.position_type.toUpperCase()} order executed! ${order.symbol} @ $${entryPrice.toFixed(2)}`);
      fetchPositions();
    } catch (error) {
      console.error('Error executing limit order:', error);
    }
  };

  // Monitor limit orders even when no open positions exist
  useEffect(() => {
    if (!user || hasOpenPositions) return;

    const checkLimitOrders = async () => {
      try {
        const { data: limitOrders } = await supabase
          .from('limit_orders')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending' as any);

        if (!limitOrders || limitOrders.length === 0) return;

        const symbols = Array.from(new Set(limitOrders.map(o => o.symbol.toUpperCase())));
        const cryptoSyms = symbols.filter(s => !isForexSymbol(s) && !isCommoditySymbol(s));

        const [cryptoRes, forexRes, commoditiesRes] = await Promise.all([
          cryptoSyms.length > 0
            ? supabase.functions.invoke('fetch-crypto-data', { body: { symbols: cryptoSyms } })
            : Promise.resolve({ data: null, error: null }),
          symbols.some(s => isForexSymbol(s))
            ? invokeForexData()
            : Promise.resolve({ data: null, error: null }),
          symbols.some(s => isCommoditySymbol(s))
            ? supabase.functions.invoke('fetch-commodities-data')
            : Promise.resolve({ data: null, error: null }),
        ]);

        const prices: Record<string, number> = {};
        if (cryptoRes.data?.cryptoData) {
          cryptoRes.data.cryptoData.forEach((c: any) => { if (c.symbol && c.price) prices[c.symbol.toUpperCase()] = parseFloat(c.price); });
        }
        if (forexRes.data?.forexData) {
          forexRes.data.forexData.forEach((f: any) => { const p = parseFloat(f.price); if (p > 0) { prices[(f.symbol || '').toUpperCase()] = p; prices[(f.name || '').toUpperCase()] = p; } });
        }
        if (commoditiesRes.data?.commoditiesData) {
          commoditiesRes.data.commoditiesData.forEach((c: any) => { const p = parseFloat(c.price); if (p > 0) prices[(c.symbol || '').toUpperCase()] = p; });
        }

        for (const order of limitOrders) {
          const mp = prices[order.symbol.toUpperCase()] || 0;
          if (mp <= 0) continue;
          const shouldExecute = 
            (order.position_type === 'long' && mp <= order.limit_price) ||
            (order.position_type === 'short' && mp >= order.limit_price);
          if (shouldExecute) {
            await executeLimitOrder(order, mp);
          }
        }
      } catch (err) {
        console.error('Error checking limit orders (no positions):', err);
      }
    };

    checkLimitOrders();
    const intervalId = setInterval(checkLimitOrders, 5000);
    return () => clearInterval(intervalId);
  }, [user, hasOpenPositions]);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      
      const { data: open, error: openError } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      const { data: closed, error: closedError } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false });

      if (openError) throw openError;
      if (closedError) throw closedError;

      setOpenPositions(open || []);
      setClosedPositions(closed || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
      toast.error('Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (position: Position) => {
    // Check if already permanently closed - prevent double close
    if (permanentlyClosedIdsRef.current.has(position.id)) {
      console.log('Position already closed, ignoring duplicate close request:', position.id);
      toast.info('This position has already been closed');
      setClosePositionId(null);
      return;
    }

    try {
      // IMMEDIATELY mark as permanently closed to prevent any re-adds
      permanentlyClosedIdsRef.current.add(position.id);
      
      // Start closing animation
      setClosingPositionId(position.id);
      
      // IMMEDIATELY remove from open positions state to prevent re-showing
      setOpenPositions(prev => prev.filter(p => p.id !== position.id));
      
      const closePrice = position.current_price;
      const quantity = getEffectivePositionAmount(position);
      const pnl = position.position_type === 'long' 
        ? (closePrice - position.entry_price) * quantity
        : (position.entry_price - closePrice) * quantity;

      const closedAt = new Date().toISOString();

      // Close position in database - use status check to prevent double close
      const { data: updateResult, error } = await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: closedAt,
          close_price: closePrice,
          pnl: pnl,
          closed_by: user?.id
        })
        .eq('id', position.id)
        .eq('status', 'open') // CRITICAL: Only update if still open
        .select();

      if (error) throw error;

      // Check if update actually happened (position was still open)
      if (!updateResult || updateResult.length === 0) {
        console.log('Position was already closed in database:', position.id);
        toast.info('Position was already closed');
        setClosingPositionId(null);
        setClosePositionId(null);
        return;
      }

      // Show success animation
      setClosingPositionId(null);
      setClosedSuccessId(position.id);

      // Wait for animation to complete before moving to closed
      await new Promise(resolve => setTimeout(resolve, 800));

      // Add to closed positions at the top
      const closedPosition: Position = {
        ...position,
        status: 'closed',
        closed_at: closedAt,
        close_price: closePrice,
        pnl: pnl
      };
      
      setClosedPositions(prev => {
        // Avoid duplicates
        if (prev.some(p => p.id === position.id)) {
          return prev;
        }
        return [closedPosition, ...prev];
      });
      
      // Clean up refs and animation state
      setClosedSuccessId(null);
      delete previousPricesRef.current[position.id];
      delete basePnlRef.current[position.id];

      // Get current wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user?.id)
        .eq('currency', 'USD')
        .single();

      if (walletError) {
        console.error('Error fetching wallet:', walletError);
      } else {
        const currentBalance = wallet?.balance || 0;
        
        // Return margin + PnL to wallet
        const finalAmount = position.margin + pnl;
        const newBalance = currentBalance + finalAmount;

        await supabase
          .from('user_wallets')
          .update({ balance: newBalance })
          .eq('user_id', user?.id)
          .eq('currency', 'USD');

        // Record transaction
        await supabase.from('wallet_transactions').insert({
          user_id: user?.id,
          type: 'trade',
          amount: finalAmount,
          currency: 'USD',
          status: 'Completed',
          reference_id: position.id
        });
      }

      toast.success(`Position closed: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} PnL. Wallet updated with $${(position.margin + pnl).toFixed(2)}`);
      setClosePositionId(null);
    } catch (error) {
      console.error('Error closing position:', error);
      toast.error('Failed to close position');
      // Remove from permanently closed set if error occurred
      permanentlyClosedIdsRef.current.delete(position.id);
      setClosingPositionId(null);
      setClosedSuccessId(null);
    }
  };

  // Auto-close position when stop loss or take profit is triggered
  const handleAutoClose = async (position: Position, reason: 'stop_loss' | 'take_profit') => {
    // Check if already permanently closed - prevent double close
    if (permanentlyClosedIdsRef.current.has(position.id)) {
      return;
    }

    try {
      // IMMEDIATELY mark as permanently closed to prevent any re-adds
      permanentlyClosedIdsRef.current.add(position.id);
      
      // IMMEDIATELY remove from open positions state
      setOpenPositions(prev => prev.filter(p => p.id !== position.id));
      
      // Determine close price based on trigger reason
      const closePrice = reason === 'stop_loss' 
        ? (position.stop_loss || position.current_price)
        : (position.take_profit || position.current_price);
        
      const quantity = getEffectivePositionAmount(position);
      const pnl = position.position_type === 'long' 
        ? (closePrice - position.entry_price) * quantity
        : (position.entry_price - closePrice) * quantity;

      const closedAt = new Date().toISOString();

      // Close position in database - use status check to prevent double close
      const { data: updateResult, error } = await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: closedAt,
          close_price: closePrice,
          pnl: pnl,
          closed_by: user?.id
        })
        .eq('id', position.id)
        .eq('status', 'open')
        .select();

      if (error) throw error;

      // Check if update actually happened
      if (!updateResult || updateResult.length === 0) {
        return;
      }

      // Add to closed positions
      const closedPosition: Position = {
        ...position,
        status: 'closed',
        closed_at: closedAt,
        close_price: closePrice,
        pnl: pnl
      };
      
      setClosedPositions(prev => {
        if (prev.some(p => p.id === position.id)) {
          return prev;
        }
        return [closedPosition, ...prev];
      });
      
      // Clean up refs
      delete previousPricesRef.current[position.id];
      delete basePnlRef.current[position.id];

      // Get current wallet balance and update
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user?.id)
        .eq('currency', 'USD')
        .single();

      if (!walletError && wallet) {
        const currentBalance = wallet.balance || 0;
        const finalAmount = position.margin + pnl;
        const newBalance = currentBalance + finalAmount;

        await supabase
          .from('user_wallets')
          .update({ balance: newBalance })
          .eq('user_id', user?.id)
          .eq('currency', 'USD');

        // Record transaction
        await supabase.from('wallet_transactions').insert({
          user_id: user?.id,
          type: 'trade',
          amount: finalAmount,
          currency: 'USD',
          status: 'Completed',
          reference_id: position.id
        });
      }

      if (reason === 'stop_loss') {
        toast.warning(`⚠️ Stop Loss triggered for ${position.symbol}! Position closed at $${closePrice.toFixed(2)}. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
      } else {
        toast.success(`🎯 Take Profit reached for ${position.symbol}! Position closed at $${closePrice.toFixed(2)}. PnL: +$${pnl.toFixed(2)}`);
      }
    } catch (error) {
      console.error(`Error auto-closing position on ${reason}:`, error);
      permanentlyClosedIdsRef.current.delete(position.id);
    }
  };

  const calculatePnL = (position: Position) => {
    if (position.status === 'closed') {
      return position.pnl || 0;
    }

    const quantity = getEffectivePositionAmount(position);
    if (position.position_type === 'long') {
      return (position.current_price - position.entry_price) * quantity;
    } else {
      return (position.entry_price - position.current_price) * quantity;
    }
  };

  const PositionCard = ({ position, showCloseButton = false }: { position: Position; showCloseButton?: boolean }) => {
    const pnl = calculatePnL(position);
    const isProfit = pnl >= 0;
    const isLong = position.position_type === 'long';
    const priceChange = priceChanges[position.id];
    const isClosing = closingPositionId === position.id;
    const isClosedSuccess = closedSuccessId === position.id;

    return (
      <Card className={`p-4 hover:shadow-lg transition-all duration-300 relative overflow-hidden ${
        isClosedSuccess ? 'scale-95 opacity-0 bg-green-500/20 border-green-500' : ''
      } ${isClosing ? 'opacity-70' : ''}`}>
        {/* Success overlay animation */}
        {isClosedSuccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 z-10 animate-fade-in">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-12 w-12 text-green-500 animate-scale-in" />
              <span className="text-green-500 font-bold text-lg">Position Closed!</span>
            </div>
          </div>
        )}
        
        {/* Loading overlay */}
        {isClosing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        )}
        
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              isLong ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {isLong ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">{position.symbol}/USDT</h3>
              <span className={`text-sm font-semibold ${isLong ? 'text-green-500' : 'text-red-500'}`}>
                {position.position_type.toUpperCase()} {position.leverage}x
              </span>
            </div>
          </div>
          {showCloseButton && !isClosing && !isClosedSuccess && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setClosePositionId(position.id)}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-semibold">{position.amount} {position.symbol}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Entry Price</p>
            <p className="font-semibold">${formatMarketPrice(position.entry_price)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Price</p>
            <div className={`flex items-center gap-1 font-semibold transition-all duration-300 ${
              priceChange?.flash 
                ? priceChange.direction === 'up' 
                  ? 'text-green-500 animate-pulse' 
                  : 'text-red-500 animate-pulse'
                : ''
            }`}>
              <span className={`px-2 py-1 rounded transition-all duration-300 ${
                priceChange?.flash
                  ? priceChange.direction === 'up'
                    ? 'bg-green-500/20'
                    : 'bg-red-500/20'
                  : ''
              }`}>
                ${formatMarketPrice(position.current_price)}
              </span>
              {priceChange?.direction === 'up' && (
                <ArrowUp className="h-4 w-4 text-green-500" />
              )}
              {priceChange?.direction === 'down' && (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Margin</p>
            <p className="font-semibold">${position.margin.toFixed(2)}</p>
          </div>
          {(position.stop_loss || position.take_profit) && (
            <div className="col-span-2 grid grid-cols-2 gap-2">
              {position.stop_loss && (
                <div>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Stop Loss
                  </p>
                  <p className="font-semibold text-red-500">${formatMarketPrice(position.stop_loss)}</p>
                </div>
              )}
              {position.take_profit && (
                <div>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Take Profit
                  </p>
                  <p className="font-semibold text-green-500">${formatMarketPrice(position.take_profit)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`mt-4 p-3 rounded-lg transition-all duration-300 ${
          priceChange?.flash
            ? priceChange.direction === 'up'
              ? 'bg-green-500/20 animate-pulse'
              : 'bg-red-500/20 animate-pulse'
            : isProfit ? 'bg-green-500/10' : 'bg-red-500/10'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">PnL</span>
            <div className="flex items-center gap-1">
              <span className={`text-lg font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                {isProfit ? '+' : ''}${formatLivePnl(pnl)}
              </span>
              {priceChange?.direction === 'up' && (
                <ArrowUp className="h-4 w-4 text-green-500" />
              )}
              {priceChange?.direction === 'down' && (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          <p>Opened: {new Date(position.opened_at).toLocaleString()}</p>
          {position.closed_at && (
            <p>Closed: {new Date(position.closed_at).toLocaleString()}</p>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-muted/40 to-background pb-20">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/3 w-[450px] h-[450px] bg-secondary/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 relative">
        <div className="absolute inset-0 backdrop-blur-2xl bg-background/75 border-b border-border/50" />
        <div className="absolute inset-x-0 -bottom-6 h-6 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <div className="relative container flex h-16 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl hover:bg-gradient-to-br hover:from-primary/15 hover:to-accent/15 hover:text-primary transition-all duration-300"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            My Positions
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl hover:bg-gradient-to-br hover:from-primary/15 hover:to-accent/15 hover:text-primary transition-all duration-300"
            onClick={fetchPositions}
            disabled={loading}
          >
            <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="relative z-10 container mx-auto p-3 sm:p-4 animate-fade-in">
        {/* Total Portfolio P&L Card - Sticky */}
        {openPositions.length > 0 && (() => {
          const totalPnL = openPositions.reduce((sum, pos) => sum + calculatePnL(pos), 0);
          const isProfit = totalPnL >= 0;
          const totalMargin = openPositions.reduce((sum, pos) => sum + pos.margin, 0);
          const pnlPercentage = totalMargin > 0 ? (totalPnL / totalMargin) * 100 : 0;

          return (
            <div className="sticky top-16 z-40 -mx-3 sm:-mx-4 px-3 sm:px-4 pb-4 pt-2 backdrop-blur-2xl bg-background/70 border-b border-border/30">
              <Card className={`relative overflow-hidden p-4 sm:p-6 border-2 backdrop-blur-xl ${isProfit ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'} shadow-xl`}>
                <div className={`absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl ${isProfit ? 'bg-emerald-500/20' : 'bg-red-500/20'}`} />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Portfolio P&L</h3>
                    <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                      <p className={`text-2xl sm:text-3xl md:text-4xl font-bold ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isProfit ? '+' : ''}${totalPnL.toFixed(2)}
                      </p>
                      <span className={`text-sm sm:text-lg font-semibold ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                        ({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Total Margin</p>
                    <p className="text-lg sm:text-xl font-bold">${totalMargin.toFixed(2)}</p>
                  </div>
                </div>
                <div className="relative mt-4 pt-4 border-t border-border/40">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-xl bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 font-semibold">Open</p>
                      <p className="text-lg font-bold">{openPositions.length}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 font-semibold">Long</p>
                      <p className="text-lg font-bold text-emerald-500">
                        {openPositions.filter(p => p.position_type === 'long').length}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 font-semibold">Short</p>
                      <p className="text-lg font-bold text-red-500">
                        {openPositions.filter(p => p.position_type === 'short').length}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          );
        })()}

        <Tabs defaultValue="open" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-auto p-1.5 bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl shadow-lg">
            <TabsTrigger
              value="open"
              className="text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:via-secondary data-[state=active]:to-accent data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)] font-semibold transition-all duration-300"
            >
              Open Positions ({openPositions.length})
            </TabsTrigger>
            <TabsTrigger
              value="closed"
              className="text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:via-secondary data-[state=active]:to-accent data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)] font-semibold transition-all duration-300"
            >
              Closed Positions ({closedPositions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4">
            {openPositions.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No open positions</p>
                <Button 
                  className="mt-4" 
                  onClick={() => navigate("/dashboard")}
                >
                  Start Trading
                </Button>
              </Card>
            ) : (
              openPositions.map(position => (
                <PositionCard 
                  key={position.id} 
                  position={position} 
                  showCloseButton={true}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-4">
            {closedPositions.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No closed positions</p>
              </Card>
            ) : (
              closedPositions.map(position => (
                <PositionCard key={position.id} position={position} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Close Position Confirmation Dialog */}
      <AlertDialog open={!!closePositionId} onOpenChange={() => setClosePositionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Position?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this position? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const position = openPositions.find(p => p.id === closePositionId);
                if (position) handleClosePosition(position);
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Close Position
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
};

export default Positions;