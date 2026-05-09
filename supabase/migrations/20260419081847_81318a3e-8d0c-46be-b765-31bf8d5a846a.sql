-- Create trading_signals table for broker-managed signals
CREATE TABLE public.trading_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pair TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('long', 'short')),
  entry_price TEXT NOT NULL,
  take_profit TEXT NOT NULL,
  stop_loss TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 80 CHECK (confidence >= 0 AND confidence <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trading_signals ENABLE ROW LEVEL SECURITY;

-- Public can view active signals (for home page)
CREATE POLICY "Anyone can view active signals"
ON public.trading_signals
FOR SELECT
USING (is_active = true);

-- Admins can view all signals
CREATE POLICY "Admins can view all signals"
ON public.trading_signals
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage signals
CREATE POLICY "Admins can insert signals"
ON public.trading_signals
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update signals"
ON public.trading_signals
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete signals"
ON public.trading_signals
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_trading_signals_updated_at
BEFORE UPDATE ON public.trading_signals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with some default signals
INSERT INTO public.trading_signals (pair, signal_type, entry_price, take_profit, stop_loss, confidence, display_order) VALUES
('BTC/USDT', 'long', '67,420', '69,800', '66,200', 92, 1),
('EUR/USD', 'short', '1.0852', '1.0780', '1.0890', 87, 2),
('XAU/USD', 'long', '2,418', '2,455', '2,400', 89, 3),
('ETH/USDT', 'long', '3,245', '3,420', '3,180', 84, 4),
('GBP/JPY', 'short', '198.45', '196.80', '199.20', 78, 5),
('USOIL', 'long', '78.20', '80.50', '77.10', 81, 6);