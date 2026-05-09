-- Create enum for withdrawal status
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'processing');

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  withdrawal_method TEXT NOT NULL,
  account_details JSONB NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  admin_notes TEXT,
  transaction_reference TEXT
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for withdrawal_requests
CREATE POLICY "Users can view own withdrawal requests"
  ON public.withdrawal_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests"
  ON public.withdrawal_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawal requests"
  ON public.withdrawal_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update withdrawal requests"
  ON public.withdrawal_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Function to approve withdrawal and update wallet
CREATE OR REPLACE FUNCTION public.approve_withdrawal(withdrawal_id UUID, transaction_ref TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal withdrawal_requests;
  v_current_balance DECIMAL(20, 2);
BEGIN
  -- Check if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve withdrawals';
  END IF;

  -- Get withdrawal details
  SELECT * INTO v_withdrawal FROM withdrawal_requests WHERE id = withdrawal_id;
  
  IF v_withdrawal.status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal already processed';
  END IF;

  -- Check if user has sufficient balance
  SELECT balance INTO v_current_balance 
  FROM user_wallets 
  WHERE user_id = v_withdrawal.user_id AND currency = v_withdrawal.currency;

  IF v_current_balance IS NULL OR v_current_balance < v_withdrawal.amount THEN
    RAISE EXCEPTION 'Insufficient balance for withdrawal';
  END IF;

  -- Update withdrawal status
  UPDATE withdrawal_requests
  SET status = 'approved',
      processed_at = now(),
      processed_by = auth.uid(),
      transaction_reference = transaction_ref
  WHERE id = withdrawal_id;

  -- Deduct from wallet
  UPDATE user_wallets
  SET balance = balance - v_withdrawal.amount,
      updated_at = now()
  WHERE user_id = v_withdrawal.user_id AND currency = v_withdrawal.currency;

  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_withdrawal.user_id, 'withdrawal', v_withdrawal.amount, v_withdrawal.currency, 'Completed', withdrawal_id);
END;
$$;

-- Function to reject withdrawal
CREATE OR REPLACE FUNCTION public.reject_withdrawal(withdrawal_id UUID, reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject withdrawals';
  END IF;

  -- Update withdrawal status
  UPDATE withdrawal_requests
  SET status = 'rejected',
      processed_at = now(),
      processed_by = auth.uid(),
      rejection_reason = reason
  WHERE id = withdrawal_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found or already processed';
  END IF;
END;
$$;