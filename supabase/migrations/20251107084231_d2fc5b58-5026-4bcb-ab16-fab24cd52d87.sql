-- Create enum for payment methods
CREATE TYPE public.payment_method AS ENUM ('upi', 'netbanking');

-- Create enum for deposit status
CREATE TYPE public.deposit_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for transaction type
CREATE TYPE public.transaction_type AS ENUM ('deposit', 'withdrawal', 'trade');

-- Create user_wallets table
CREATE TABLE public.user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, currency)
);

-- Create deposit_requests table
CREATE TABLE public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method payment_method NOT NULL,
  transaction_id TEXT NOT NULL,
  status deposit_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT
);

-- Create wallet_transactions table
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_wallets
CREATE POLICY "Users can view own wallet"
  ON public.user_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet"
  ON public.user_wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for deposit_requests
CREATE POLICY "Users can view own deposit requests"
  ON public.deposit_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create deposit requests"
  ON public.deposit_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deposit requests"
  ON public.deposit_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update deposit requests"
  ON public.deposit_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view own transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_user_wallets_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to approve deposit and update wallet
CREATE OR REPLACE FUNCTION public.approve_deposit(deposit_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit deposit_requests;
  v_wallet_id UUID;
BEGIN
  -- Check if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve deposits';
  END IF;

  -- Get deposit details
  SELECT * INTO v_deposit FROM deposit_requests WHERE id = deposit_id;
  
  IF v_deposit.status != 'pending' THEN
    RAISE EXCEPTION 'Deposit already processed';
  END IF;

  -- Update deposit status
  UPDATE deposit_requests
  SET status = 'approved',
      approved_at = now(),
      approved_by = auth.uid()
  WHERE id = deposit_id;

  -- Update or create wallet
  INSERT INTO user_wallets (user_id, currency, balance)
  VALUES (v_deposit.user_id, v_deposit.currency, v_deposit.amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET 
    balance = user_wallets.balance + v_deposit.amount,
    updated_at = now()
  RETURNING id INTO v_wallet_id;

  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_deposit.user_id, 'deposit', v_deposit.amount, v_deposit.currency, 'Completed', deposit_id);
END;
$$;