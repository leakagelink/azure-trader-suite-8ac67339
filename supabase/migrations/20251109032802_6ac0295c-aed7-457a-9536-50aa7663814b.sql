-- Create enum for position types
CREATE TYPE public.position_type AS ENUM ('long', 'short');

-- Create enum for position status
CREATE TYPE public.position_status AS ENUM ('open', 'closed');

-- Create positions table
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  position_type position_type NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  entry_price NUMERIC(20, 2) NOT NULL,
  current_price NUMERIC(20, 2) NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  margin NUMERIC(20, 2) NOT NULL,
  pnl NUMERIC(20, 2) DEFAULT 0,
  status position_status NOT NULL DEFAULT 'open',
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID,
  close_price NUMERIC(20, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- Users can view their own positions
CREATE POLICY "Users can view own positions"
ON public.positions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own positions
CREATE POLICY "Users can create own positions"
ON public.positions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own positions
CREATE POLICY "Users can update own positions"
ON public.positions
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all positions
CREATE POLICY "Admins can view all positions"
ON public.positions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update all positions
CREATE POLICY "Admins can update all positions"
ON public.positions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create index for better performance
CREATE INDEX idx_positions_user_id ON public.positions(user_id);
CREATE INDEX idx_positions_status ON public.positions(status);
CREATE INDEX idx_positions_user_status ON public.positions(user_id, status);

-- Create trigger to update updated_at
CREATE TRIGGER update_positions_updated_at
BEFORE UPDATE ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();