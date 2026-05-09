-- Update approve_deposit function to use dynamic settings from payment_settings table
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
  v_bonus_enabled BOOLEAN;
  v_bonus_percentage DECIMAL(5, 2);
  v_min_amount DECIMAL(20, 2);
  v_max_amount DECIMAL(20, 2);
  v_bonus_max DECIMAL(20, 2);
  v_offer_title TEXT;
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

  -- Update or create wallet with total amount (deposit + bonus)
  INSERT INTO user_wallets (user_id, currency, balance)
  VALUES (v_deposit.user_id, v_deposit.currency, v_total_amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET 
    balance = user_wallets.balance + v_total_amount,
    updated_at = now()
  RETURNING id INTO v_wallet_id;

  -- Create transaction record for deposit
  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_deposit.user_id, 'deposit', v_deposit.amount, v_deposit.currency, 'Completed', deposit_id);

  -- Create bonus transaction record if applicable
  IF v_bonus_amount > 0 THEN
    INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
    VALUES (v_deposit.user_id, 'deposit', v_bonus_amount, v_deposit.currency, v_offer_title || ' ' || v_bonus_percentage || '%', deposit_id);
  END IF;
END;
$function$;