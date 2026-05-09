-- Update approve_deposit function to include Christmas 30% bonus for deposits between $200-$2000
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

  -- Calculate Christmas bonus (30% for deposits between $200 and $2000)
  IF v_deposit.amount >= 200 AND v_deposit.amount <= 2000 THEN
    v_bonus_amount := v_deposit.amount * 0.30;
    -- Cap bonus at $600 (30% of $2000)
    IF v_bonus_amount > 600 THEN
      v_bonus_amount := 600;
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
    VALUES (v_deposit.user_id, 'deposit', v_bonus_amount, v_deposit.currency, 'Christmas Bonus 30%', deposit_id);
  END IF;
END;
$function$;