
CREATE OR REPLACE FUNCTION public.auto_liquidate_positions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    UPDATE public.positions
    SET status = 'closed',
        closed_at = now(),
        close_price = current_price,
        pnl = -margin,
        updated_at = now()
    WHERE status = 'open'
      AND margin > 0
      AND pnl <= -margin
    RETURNING id, user_id, margin
  LOOP
    v_count := v_count + 1;

    -- Record the realized loss in wallet_transactions for visibility.
    -- No wallet balance change: margin was already deducted at trade open,
    -- and a -100% liquidation means refund = margin + (-margin) = 0.
    INSERT INTO public.wallet_transactions
      (user_id, type, amount, currency, status, reference_id)
    VALUES
      (v_row.user_id, 'trade', -v_row.margin, 'USD', 'Completed', v_row.id);
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_liquidate_positions() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_liquidate_positions() TO service_role;
