-- Fix the lock_deposit function to not reference non-existent updated_at column
CREATE OR REPLACE FUNCTION public.lock_deposit(p_user_id uuid, p_amount numeric, p_currency text, p_deposit_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update or create wallet with locked balance
  INSERT INTO user_wallets (user_id, currency, balance, locked_balance)
  VALUES (p_user_id, p_currency, 0, p_amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET 
    locked_balance = user_wallets.locked_balance + p_amount,
    updated_at = now();

  -- Update deposit status to 'locked' (deposit_requests doesn't have updated_at column)
  UPDATE deposit_requests
  SET status = 'locked'
  WHERE id = p_deposit_id;
END;
$function$;