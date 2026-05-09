-- Create function to reject locked deposits and refund locked balance
CREATE OR REPLACE FUNCTION reject_deposit(deposit_id UUID)
RETURNS VOID AS $$
DECLARE
  v_deposit RECORD;
BEGIN
  -- Get the deposit request
  SELECT * INTO v_deposit FROM deposit_requests WHERE id = deposit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit request not found';
  END IF;
  
  IF v_deposit.status NOT IN ('pending', 'locked') THEN
    RAISE EXCEPTION 'Deposit request is not pending or locked';
  END IF;
  
  -- Update deposit status to rejected
  UPDATE deposit_requests
  SET status = 'rejected',
      rejection_reason = 'Rejected by admin'
  WHERE id = deposit_id;
  
  -- If the deposit was locked, remove the amount from locked_balance in INR wallet
  IF v_deposit.status = 'locked' THEN
    UPDATE user_wallets
    SET locked_balance = GREATEST(0, COALESCE(locked_balance, 0) - v_deposit.amount),
        updated_at = now()
    WHERE user_id = v_deposit.user_id AND currency = 'INR';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;