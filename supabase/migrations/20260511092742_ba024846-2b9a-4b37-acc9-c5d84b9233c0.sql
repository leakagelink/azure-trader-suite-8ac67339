
CREATE OR REPLACE FUNCTION public.check_edited_positions_consistency()
RETURNS TABLE (
  position_id UUID,
  user_id UUID,
  symbol TEXT,
  position_type TEXT,
  current_price NUMERIC,
  entry_price NUMERIC,
  amount NUMERIC,
  stored_pnl NUMERIC,
  expected_pnl NUMERIC,
  pnl_drift NUMERIC,
  seconds_since_update NUMERIC,
  momentum_active BOOLEAN,
  momentum_direction TEXT,
  momentum_target_price NUMERIC,
  issues TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only Brokers can run consistency checks';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id,
      p.user_id,
      p.symbol,
      p.position_type::text AS position_type,
      p.current_price,
      p.entry_price,
      p.amount,
      p.pnl AS stored_pnl,
      CASE WHEN p.position_type = 'long'
        THEN (p.current_price - p.entry_price) * p.amount
        ELSE (p.entry_price - p.current_price) * p.amount
      END AS expected_pnl,
      EXTRACT(EPOCH FROM (now() - p.updated_at))::numeric AS seconds_since_update,
      p.momentum_active,
      p.momentum_direction,
      p.momentum_target_price
    FROM positions p
    WHERE p.status = 'open'
      AND p.price_mode = 'edited'
  )
  SELECT
    b.id,
    b.user_id,
    b.symbol,
    b.position_type,
    b.current_price,
    b.entry_price,
    b.amount,
    b.stored_pnl,
    b.expected_pnl,
    abs(b.stored_pnl - b.expected_pnl) AS pnl_drift,
    b.seconds_since_update,
    b.momentum_active,
    b.momentum_direction,
    b.momentum_target_price,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN abs(b.stored_pnl - b.expected_pnl) > GREATEST(0.01, abs(b.expected_pnl) * 0.001)
           THEN 'pnl_mismatch' END,
      CASE WHEN b.seconds_since_update > 30 THEN 'stale_no_drift' END,
      CASE WHEN b.momentum_active IS NOT TRUE THEN 'momentum_inactive' END,
      CASE WHEN b.momentum_direction IS NULL THEN 'missing_direction' END,
      CASE WHEN b.momentum_target_price IS NULL THEN 'missing_target' END
    ], NULL) AS issues
  FROM base b
  WHERE
    abs(b.stored_pnl - b.expected_pnl) > GREATEST(0.01, abs(b.expected_pnl) * 0.001)
    OR b.seconds_since_update > 30
    OR b.momentum_active IS NOT TRUE
    OR b.momentum_direction IS NULL
    OR b.momentum_target_price IS NULL
  ORDER BY b.seconds_since_update DESC;
END;
$$;
