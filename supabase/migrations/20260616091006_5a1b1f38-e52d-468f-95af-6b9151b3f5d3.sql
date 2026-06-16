
CREATE OR REPLACE FUNCTION public.auto_liquidate_positions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH liquidated AS (
    UPDATE public.positions
    SET status = 'closed',
        closed_at = now(),
        close_price = current_price,
        pnl = -margin,
        updated_at = now()
    WHERE status = 'open'
      AND margin > 0
      AND pnl <= -margin
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM liquidated;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_liquidate_positions() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_liquidate_positions() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-liquidate-positions-5s')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-liquidate-positions-5s');
END $$;

SELECT cron.schedule(
  'auto-liquidate-positions-5s',
  '5 seconds',
  $$ SELECT public.auto_liquidate_positions(); $$
);
