-- Update approve_deposit to convert INR to USD
-- Using a fixed exchange rate (can be made dynamic via payment_settings later)
CREATE OR REPLACE FUNCTION public.approve_deposit(deposit_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deposit deposit_requests;
  v_wallet_id UUID;
  v_bonus_amount DECIMAL(20, 2);
  v_total_amount DECIMAL(20, 2);
  v_usd_amount DECIMAL(20, 2);
  v_bonus_enabled BOOLEAN;
  v_bonus_percentage DECIMAL(5, 2);
  v_min_amount DECIMAL(20, 2);
  v_max_amount DECIMAL(20, 2);
  v_bonus_max DECIMAL(20, 2);
  v_offer_title TEXT;
  v_current_locked DECIMAL(20, 2);
  v_exchange_rate DECIMAL(10, 4);
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

  -- Get exchange rate from payment_settings or use default (1 USD = 85 INR approx)
  SELECT COALESCE(
    (SELECT setting_value::DECIMAL FROM payment_settings WHERE setting_key = 'inr_to_usd_rate'),
    0.012 -- Default: 1 INR = 0.012 USD (approx 1 USD = 83.33 INR)
  ) INTO v_exchange_rate;

  -- Convert INR to USD
  v_usd_amount := v_deposit.amount * v_exchange_rate;

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

  -- Calculate bonus based on USD amount
  IF v_bonus_enabled AND v_usd_amount >= v_min_amount AND v_usd_amount <= v_max_amount THEN
    v_bonus_amount := v_usd_amount * (v_bonus_percentage / 100);
    -- Cap bonus at max bonus amount
    IF v_bonus_amount > v_bonus_max THEN
      v_bonus_amount := v_bonus_max;
    END IF;
  ELSE
    v_bonus_amount := 0;
  END IF;
  
  v_total_amount := v_usd_amount + v_bonus_amount;

  -- Update deposit status
  UPDATE deposit_requests
  SET status = 'approved',
      approved_at = now(),
      approved_by = auth.uid()
  WHERE id = deposit_id;

  -- Check if this was a locked deposit (in INR wallet)
  SELECT locked_balance INTO v_current_locked
  FROM user_wallets
  WHERE user_id = v_deposit.user_id AND currency = 'INR';

  -- If deposit was locked, remove from INR locked balance
  IF v_deposit.status = 'locked' AND v_current_locked >= v_deposit.amount THEN
    -- Deduct from INR locked balance
    UPDATE user_wallets
    SET locked_balance = locked_balance - v_deposit.amount,
        updated_at = now()
    WHERE user_id = v_deposit.user_id AND currency = 'INR';
  END IF;

  -- Add converted USD amount to USD wallet
  INSERT INTO user_wallets (user_id, currency, balance, locked_balance)
  VALUES (v_deposit.user_id, 'USD', v_total_amount, 0)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET 
    balance = user_wallets.balance + v_total_amount,
    updated_at = now()
  RETURNING id INTO v_wallet_id;

  -- Create transaction record for deposit (in USD)
  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_deposit.user_id, 'deposit', v_usd_amount, 'USD', 'Completed', deposit_id);

  -- Create bonus transaction record if applicable
  IF v_bonus_amount > 0 THEN
    INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
    VALUES (v_deposit.user_id, 'deposit', v_bonus_amount, 'USD', v_offer_title || ' ' || v_bonus_percentage || '%', deposit_id);
  END IF;
END;
$function$;

-- Also update lock_deposit to always use INR currency
CREATE OR REPLACE FUNCTION public.lock_deposit(p_user_id uuid, p_amount numeric, p_currency text, p_deposit_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update or create INR wallet with locked balance (always store deposits as INR locked)
  INSERT INTO user_wallets (user_id, currency, balance, locked_balance)
  VALUES (p_user_id, 'INR', 0, p_amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET 
    locked_balance = user_wallets.locked_balance + p_amount,
    updated_at = now();

  -- Update deposit status to 'locked'
  UPDATE deposit_requests
  SET status = 'locked'
  WHERE id = p_deposit_id;
END;
$function$;