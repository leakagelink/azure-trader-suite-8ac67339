
-- Create limit order status enum
CREATE TYPE public.limit_order_status AS ENUM ('pending', 'executed', 'cancelled');

-- Create limit_orders table
CREATE TABLE public.limit_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  position_type public.position_type NOT NULL,
  input_mode TEXT NOT NULL DEFAULT 'amount',
  amount NUMERIC,
  lot_size NUMERIC,
  leverage INTEGER NOT NULL DEFAULT 1,
  limit_price NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  status public.limit_order_status NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.limit_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own limit orders"
ON public.limit_orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own limit orders"
ON public.limit_orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own limit orders"
ON public.limit_orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all limit orders"
ON public.limit_orders FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all limit orders"
ON public.limit_orders FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_limit_orders_updated_at
BEFORE UPDATE ON public.limit_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.limit_orders;
