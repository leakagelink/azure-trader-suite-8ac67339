-- Fix approve_deposit function - reference_id is UUID, not text
CREATE OR REPLACE FUNCTION approve_deposit(deposit_id UUID)
RETURNS VOID AS $$
DECLARE
  v_deposit RECORD;
  v_exchange_rate NUMERIC := 0.012;
  v_bonus_enabled BOOLEAN := false;
  v_bonus_percentage NUMERIC := 0;
  v_min_amount NUMERIC := 0;
  v_max_amount NUMERIC := 999999;
  v_bonus_max NUMERIC := 0;
  v_usd_amount NUMERIC;
  v_bonus_amount NUMERIC := 0;
  v_total_amount NUMERIC;
  v_setting_value TEXT;
BEGIN
  -- Get the deposit request
  SELECT * INTO v_deposit FROM deposit_requests WHERE id = deposit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit request not found';
  END IF;
  
  IF v_deposit.status NOT IN ('pending', 'locked') THEN
    RAISE EXCEPTION 'Deposit request is not pending or locked';
  END IF;
  
  -- Fetch exchange rate from payment_settings
  SELECT setting_value INTO v_setting_value 
  FROM payment_settings 
  WHERE setting_key = 'exchange_rate';
  
  IF v_setting_value IS NOT NULL AND v_setting_value != '' THEN
    v_exchange_rate := v_setting_value::NUMERIC;
  END IF;
  
  -- Fetch bonus settings
  SELECT setting_value INTO v_setting_value 
  FROM payment_settings 
  WHERE setting_key = 'deposit_bonus_enabled';
  
  IF v_setting_value = 'true' THEN
    v_bonus_enabled := true;
  END IF;
  
  SELECT setting_value INTO v_setting_value 
  FROM payment_settings 
  WHERE setting_key = 'deposit_bonus_percentage';
  
  IF v_setting_value IS NOT NULL AND v_setting_value != '' THEN
    v_bonus_percentage := v_setting_value::NUMERIC;
  END IF;
  
  SELECT setting_value INTO v_setting_value 
  FROM payment_settings 
  WHERE setting_key = 'deposit_min_amount';
  
  IF v_setting_value IS NOT NULL AND v_setting_value != '' THEN
    v_min_amount := v_setting_value::NUMERIC;
  END IF;
  
  SELECT setting_value INTO v_setting_value 
  FROM payment_settings 
  WHERE setting_key = 'deposit_max_amount';
  
  IF v_setting_value IS NOT NULL AND v_setting_value != '' THEN
    v_max_amount := v_setting_value::NUMERIC;
  END IF;
  
  SELECT setting_value INTO v_setting_value 
  FROM payment_settings 
  WHERE setting_key = 'deposit_bonus_max';
  
  IF v_setting_value IS NOT NULL AND v_setting_value != '' THEN
    v_bonus_max := v_setting_value::NUMERIC;
  END IF;
  
  -- Convert INR to USD using dynamic exchange rate
  IF v_deposit.currency = 'INR' THEN
    v_usd_amount := v_deposit.amount * v_exchange_rate;
  ELSE
    v_usd_amount := v_deposit.amount;
  END IF;
  
  -- Calculate bonus if enabled and amount is within range
  IF v_bonus_enabled AND v_usd_amount >= v_min_amount AND v_usd_amount <= v_max_amount THEN
    v_bonus_amount := v_usd_amount * (v_bonus_percentage / 100);
    -- Cap the bonus at max bonus amount
    IF v_bonus_amount > v_bonus_max THEN
      v_bonus_amount := v_bonus_max;
    END IF;
  END IF;
  
  v_total_amount := v_usd_amount + v_bonus_amount;
  
  -- Update deposit status
  UPDATE deposit_requests
  SET status = 'approved',
      approved_at = now(),
      approved_by = auth.uid()
  WHERE id = deposit_id;
  
  -- If the deposit was locked, reduce the locked_balance in INR wallet
  IF v_deposit.status = 'locked' THEN
    UPDATE user_wallets
    SET locked_balance = COALESCE(locked_balance, 0) - v_deposit.amount,
        updated_at = now()
    WHERE user_id = v_deposit.user_id AND currency = 'INR';
  END IF;
  
  -- Add to user's USD wallet balance
  INSERT INTO user_wallets (user_id, currency, balance)
  VALUES (v_deposit.user_id, 'USD', v_total_amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET balance = user_wallets.balance + v_total_amount, updated_at = now();
  
  -- Create transaction record (reference_id is UUID, pass deposit_id directly)
  INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference_id)
  VALUES (v_deposit.user_id, 'deposit', v_total_amount, 'USD', 'Completed', deposit_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;