-- Add locked_balance column to user_wallets
ALTER TABLE public.user_wallets 
ADD COLUMN IF NOT EXISTS locked_balance DECIMAL(20, 2) DEFAULT 0;

-- Create function to auto-lock deposit (add to locked balance)
CREATE OR REPLACE FUNCTION public.lock_deposit(
  p_user_id UUID,
  p_amount DECIMAL,
  p_currency TEXT,
  p_deposit_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update or create wallet with locked balance
  INSERT INTO user_wallets (user_id, currency, balance, locked_balance)
  VALUES (p_user_id, p_currency, 0, p_amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET 
    locked_balance = user_wallets.locked_balance + p_amount,
    updated_at = now();

  -- Update deposit status to 'locked'
  UPDATE deposit_requests
  SET status = 'locked',
      updated_at = now()
  WHERE id = p_deposit_id;
END;
$$;

-- Update approve_deposit to handle locked balance (move from locked to available)
CREATE OR REPLACE FUNCTION public.approve_deposit(deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deposit deposit_requests;
  v_wallet_id UUID;
  v_bonus_amount DECIMAL(20, 2);
  v_total_amount DECIMAL(20, 2);
  v_bonus_enabled BOOLEAN;
  v_bonus_percentage DECIMAL(5, 2);
  v_min_amount DECIMAL(20, 2);
  v_max_amount DECIMAL(20, 2);
  v_bonus_max DECIMAL(20, 2);
  v_offer_title TEXT;
  v_current_locked DECIMAL(20, 2);
BEGIN
  -- Check if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve deposits';
  END IF;

  -- Get deposit details
  SELECT * INTO v_deposit FROM deposit_requests WHERE id = deposit_id;
  
  IF v_deposit.status NOT IN ('pending', 'locked') THEN
    RAISE EXCEPTION 'Deposit already processed';
  END IF;

  -- Fetch deposit offer settings from payment_settings
  SELECT COALESCE(
    (SELECT setting_value::BOOLEAN FROM payment_settings WHERE setting_key = 'deposit_bonus_enabled'),
    false
  ) INTO v_bonus_enabled;
  
  SELECT COALESCE(
    (SELECT setting_value::DECIMAL FROM payment_settings WHERE setting_key = 'deposit_bonus_percentage'),
    0
  ) INTO v_bonus_percentage;
  
  SELECT COALESCE(
    (SELECT setting_value::DECIMAL FROM payment_settings WHERE setting_key = 'deposit_min_amount'),
    0
  ) INTO v_min_amount;
  
  SELECT COALESCE(
    (SELECT setting_value::DECIMAL FROM payment_settings WHERE setting_key = 'deposit_max_amount'),
    999999
  ) INTO v_max_amount;
  
  SELECT COALESCE(
    (SELECT setting_value::DECIMAL FROM payment_settings WHERE setting_key = 'deposit_bonus_max'),
    999999
  ) INTO v_bonus_max;
  
  SELECT COALESCE(
    (SELECT setting_value FROM payment_settings WHERE setting_key = 'deposit_offer_title'),
    'Bonus'
  ) INTO v_offer_title;

  -- Calculate bonus based on dynamic settings
  IF v_bonus_enabled AND v_deposit.amount >= v_min_amount AND v_deposit.amount <= v_max_amount THEN
    v_bonus_amount := v_deposit.amount * (v_bonus_percentage / 100);
    -- Cap bonus at max bonus amount
    IF v_bonus_amount > v_bonus_max THEN
      v_bonus_amount := v_bonus_max;
    END IF;
  ELSE
    v_bonus_amount := 0;
  END IF;
  
  v_total_amount := v_deposit.amount + v_bonus_amount;

  -- Update deposit status
  UPDATE deposit_requests
  SET status = 'approved',
      approved_at = now(),
      approved_by = auth.uid()
  WHERE id = deposit_id;

  -- Check if this was a locked deposit
  SELECT locked_balance INTO v_current_locked
  FROM user_wallets
  WHERE user_id = v_deposit.user_id AND currency = v_deposit.currency;

  -- If deposit was locked, move from locked to available
  IF v_deposit.status = 'locked' AND v_current_locked >= v_deposit.amount THEN
    UPDATE user_wallets
    SET 
      balance = balance + v_total_amount,
      locked_balance = locked_balance - v_deposit.amount,
      updated_at = now()
    WHERE user_id = v_deposit.user_id AND currency = v_deposit.currency
    RETURNING id INTO v_wallet_id;
  ELSE
    -- Regular deposit - add directly to balance
    INSERT INTO user_wallets (user_id, currency, balance, locked_balance)
    VALUES (v_deposit.user_id, v_deposit.currency, v_total_amount, 0)
    ON CONFLICT (user_id, currency)
    DO UPDATE SET 
      balance = user_wallets.balance + v_total_amount,
      updated_at = now()
    RETURNING id INTO v_wallet_id;
  END IF;

  -- Create transaction record for deposit
  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_deposit.user_id, 'deposit', v_deposit.amount, v_deposit.currency, 'Completed', deposit_id);

  -- Create bonus transaction record if applicable
  IF v_bonus_amount > 0 THEN
    INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
    VALUES (v_deposit.user_id, 'deposit', v_bonus_amount, v_deposit.currency, v_offer_title || ' ' || v_bonus_percentage || '%', deposit_id);
  END IF;
END;
$$;

-- Add 'locked' to deposit_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'locked' AND enumtypid = 'public.deposit_status'::regtype) THEN
    ALTER TYPE public.deposit_status ADD VALUE 'locked';
  END IF;
END$$;