import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, X, RefreshCcw, Search, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { modeLogger } from "@/lib/modeEventLogger";
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
  pnl: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
  close_price?: number;
  price_mode?: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
}

const AdminPositions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [closePositionId, setClosePositionId] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<Record<string, { direction: 'up' | 'down' | 'none'; flash: boolean }>>({});
  const previousPricesRef = useRef<Record<string, number>>({});
  const openPositionsRef = useRef<Position[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    openPositionsRef.current = openPositions;
  }, [openPositions]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    checkAdminAndFetch();
  }, [user, navigate]);

  // Real-time price updates for open positions
  useEffect(() => {
    if (!isAdmin) return;

    const updatePrices = async () => {
      const positions = openPositionsRef.current;
      if (positions.length === 0) return;

      try {
        // Batch fetch all live market prices
        const liveSymbols = positions
          .filter(p => p.price_mode !== 'manual' && p.price_mode !== 'edited')
          .map(p => p.symbol);

        let livePricesMap: Record<string, number> = {};
        
        if (liveSymbols.length > 0) {
          try {
            const { data, error } = await supabase.functions.invoke('fetch-crypto-data', {
              body: { symbols: liveSymbols }
            });

            if (!error && data?.cryptoData && Array.isArray(data.cryptoData)) {
              data.cryptoData.forEach((coin: any) => {
                if (coin.symbol && coin.price) {
                  livePricesMap[coin.symbol.toUpperCase()] = parseFloat(coin.price);
                }
              });
            }
          } catch (err) {
            console.error('Error fetching live prices:', err);
          }
        }

        const updatedPositions = positions.map((position) => {
          // Edited trades: server cron drives current_price/pnl via realtime. Do NOT touch.
          if (position.price_mode === 'edited') {
            const previousPrice = previousPricesRef.current[position.id];
            if (previousPrice !== undefined && previousPrice !== position.current_price) {
              const direction = position.current_price > previousPrice ? 'up' : 'down';
              setPriceChanges(prev => ({ ...prev, [position.id]: { direction, flash: true } }));
              setTimeout(() => {
                setPriceChanges(prev => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
              }, 500);
            }
            previousPricesRef.current[position.id] = position.current_price;
            modeLogger.debug("AdminPositions.tsx/livefeed", "db_skip",
              `Skipped admin live write — row in edited mode (cron drives it)`,
              { position_id: position.id, symbol: position.symbol, price_mode: "edited" });
            return { ...position };
          }

          let currentPrice = position.current_price;

          // Check if this is a manual trade
          if (position.price_mode === 'manual') {
            // Generate fake momentum between 1-5% for manual trades
            const randomPercent = (Math.random() * 4 + 1) * (Math.random() > 0.5 ? 1 : -1);
            currentPrice = position.entry_price * (1 + randomPercent / 100);
          } else {
            // Use live market price if available
            const livePrice = livePricesMap[position.symbol.toUpperCase()];
            if (livePrice) {
              currentPrice = livePrice;
            }
          }

          // Calculate new PnL
          const quantity = getEffectivePositionAmount(position);
          const pnl = position.position_type === 'long'
            ? (currentPrice - position.entry_price) * quantity
            : (position.entry_price - currentPrice) * quantity;

          // Update database in background (non-blocking) — only for live/manual
          supabase
            .from('positions')
            .update({ 
              current_price: currentPrice,
              pnl: pnl,
              updated_at: new Date().toISOString()
            }, { count: 'exact' } as any)
            .eq('id', position.id)
            .eq('status', 'open')
            .eq('price_mode', position.price_mode as any)
            .then(({ error, count }) => {
              if (error) {
                modeLogger.error("AdminPositions.tsx/livefeed", "db_update",
                  `Admin live tick write failed: ${error.message}`,
                  { position_id: position.id, symbol: position.symbol, price_mode: position.price_mode });
                console.error('Error updating position:', error);
              } else if (count === 0) {
                modeLogger.warn("AdminPositions.tsx/livefeed", "db_guard_block",
                  `Admin live write blocked — price_mode changed mid-flight`,
                  { position_id: position.id, symbol: position.symbol, price_mode: position.price_mode });
              } else {
                modeLogger.debug("AdminPositions.tsx/livefeed", "db_update",
                  `Admin live tick written (${position.price_mode})`,
                  { position_id: position.id, symbol: position.symbol, price_mode: position.price_mode,
                    data: { current_price: currentPrice, pnl } });
              }
            });

          // Track price changes for visual indicators
          const previousPrice = previousPricesRef.current[position.id];
          if (previousPrice !== undefined && previousPrice !== currentPrice) {
            const direction = currentPrice > previousPrice ? 'up' : 'down';
            setPriceChanges(prev => ({ ...prev, [position.id]: { direction, flash: true } }));
            
            // Remove flash effect after animation
            setTimeout(() => {
              setPriceChanges(prev => ({ ...prev, [position.id]: { ...prev[position.id], flash: false } }));
            }, 500);
          }
          
          // Store current price for next comparison
          previousPricesRef.current[position.id] = currentPrice;

          // Return updated position
          return {
            ...position,
            current_price: currentPrice,
            pnl: pnl
          };
        });

        // Update state immediately for real-time UI updates
        setOpenPositions(updatedPositions);
      } catch (error) {
        console.error('Error updating prices:', error);
      }
    };

    // Live momentum disabled - admin positions show static prices
    // No interval updates
  }, [isAdmin]);

  const checkAdminAndFetch = async () => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!data) {
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      fetchPositions();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/dashboard");
    }
  };

  const fetchPositions = async () => {
    try {
      setLoading(true);
      
      const { data: open, error: openError } = await supabase
        .from('positions')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      const { data: closed, error: closedError } = await supabase
        .from('positions')
        .select('*')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false });

      if (openError) throw openError;
      if (closedError) throw closedError;

      // Fetch user profiles for all positions
      const userIds = [...new Set([
        ...(open || []).map(p => p.user_id),
        ...(closed || []).map(p => p.user_id)
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichPositions = (positions: any[]) => 
        positions.map(pos => ({
          ...pos,
          profiles: profileMap.get(pos.user_id)
        }));

      setOpenPositions(enrichPositions(open || []));
      setClosedPositions(enrichPositions(closed || []));
    } catch (error) {
      console.error('Error fetching positions:', error);
      toast.error('Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (position: Position) => {
    try {
      const closePrice = position.current_price;
      const quantity = getEffectivePositionAmount(position);
      const pnl = position.position_type === 'long' 
        ? (closePrice - position.entry_price) * quantity
        : (position.entry_price - closePrice) * quantity;

      const { error } = await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          close_price: closePrice,
          pnl: pnl,
          closed_by: user?.id
        })
        .eq('id', position.id);

      if (error) throw error;

      toast.success(`Position closed by broker: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} PnL`);
      setClosePositionId(null);
      fetchPositions();
    } catch (error) {
      console.error('Error closing position:', error);
      toast.error('Failed to close position');
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

  const filterPositions = (positions: Position[]) => {
    if (!searchQuery.trim()) return positions;
    
    const query = searchQuery.toLowerCase();
    return positions.filter(pos =>
      pos.symbol.toLowerCase().includes(query) ||
      pos.profiles?.full_name?.toLowerCase().includes(query) ||
      pos.profiles?.email?.toLowerCase().includes(query)
    );
  };

  const PositionCard = ({ position, showCloseButton = false }: { position: Position; showCloseButton?: boolean }) => {
    const pnl = calculatePnL(position);
    const isProfit = pnl >= 0;
    const isLong = position.position_type === 'long';
    const priceChange = priceChanges[position.id];

    return (
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isLong ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {isLong ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg">{position.symbol}/USDT</h3>
              <span className={`text-sm font-semibold ${isLong ? 'text-green-500' : 'text-red-500'}`}>
                {position.position_type === 'long' ? 'BUY' : 'SELL'} {position.leverage}x
              </span>
              <p className="text-xs text-muted-foreground truncate">
                {position.profiles?.full_name || position.profiles?.email || 'Unknown User'}
              </p>
            </div>
          </div>
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setClosePositionId(position.id)}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 flex-shrink-0"
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
            <p className="font-semibold">${position.entry_price.toFixed(2)}</p>
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
                ${position.current_price.toFixed(2)}
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
                {isProfit ? '+' : ''}${pnl.toFixed(2)}
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">All User Positions</h1>
          <Button variant="ghost" size="icon" onClick={fetchPositions} disabled={loading}>
            <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by symbol, user name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="open" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="open" className="text-sm sm:text-base">
              Open Positions ({filterPositions(openPositions).length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-sm sm:text-base">
              Closed Positions ({filterPositions(closedPositions).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4">
            {filterPositions(openPositions).length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No positions found' : 'No open positions'}
                </p>
              </Card>
            ) : (
              filterPositions(openPositions).map(position => (
                <PositionCard 
                  key={position.id} 
                  position={position} 
                  showCloseButton={true}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-4">
            {filterPositions(closedPositions).length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No positions found' : 'No closed positions'}
                </p>
              </Card>
            ) : (
              filterPositions(closedPositions).map(position => (
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
            <AlertDialogTitle>Close User Position?</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to close this user's position? This action cannot be undone.
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
    </div>
  );
};

export default AdminPositions;