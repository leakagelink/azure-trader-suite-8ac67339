
-- Audit log table
CREATE TABLE public.position_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL,
  user_id UUID NOT NULL, -- owner of the position
  changed_by UUID, -- who made the change (NULL = system/cron)
  change_type TEXT NOT NULL, -- 'price_mode' | 'current_price' | 'pnl' | 'entry_price' | 'stop_loss' | 'take_profit' | 'status' | 'close_price'
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  symbol TEXT,
  position_type TEXT,
  source TEXT, -- 'broker' | 'user' | 'system'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pal_position_id ON public.position_audit_log(position_id);
CREATE INDEX idx_pal_created_at ON public.position_audit_log(created_at DESC);
CREATE INDEX idx_pal_change_type ON public.position_audit_log(change_type);

ALTER TABLE public.position_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view position audit log"
  ON public.position_audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert audit log"
  ON public.position_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_position_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_source TEXT;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Determine source. Cron job runs without auth.uid() -> system, skip noisy fields.
  IF v_actor IS NULL THEN
    v_source := 'system';
  ELSE
    SELECT has_role(v_actor, 'admin'::app_role) INTO v_is_admin;
    v_source := CASE WHEN v_is_admin THEN 'broker' ELSE 'user' END;
  END IF;

  -- Skip system (cron) updates entirely so the log isn't flooded with drift ticks.
  IF v_source = 'system' THEN
    RETURN NEW;
  END IF;

  -- Skip user-initiated current_price/pnl tick updates (live feed writes from Positions.tsx).
  -- Only log meaningful broker edits. Users can still trigger status/stop_loss/take_profit logs.
  IF v_source = 'user' AND (
    (NEW.current_price IS DISTINCT FROM OLD.current_price OR NEW.pnl IS DISTINCT FROM OLD.pnl)
    AND NEW.price_mode = OLD.price_mode
    AND NEW.status = OLD.status
    AND NEW.stop_loss IS NOT DISTINCT FROM OLD.stop_loss
    AND NEW.take_profit IS NOT DISTINCT FROM OLD.take_profit
    AND NEW.entry_price IS NOT DISTINCT FROM OLD.entry_price
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.price_mode IS DISTINCT FROM OLD.price_mode THEN
    INSERT INTO position_audit_log(position_id, user_id, changed_by, change_type, field_name, old_value, new_value, symbol, position_type, source)
    VALUES (NEW.id, NEW.user_id, v_actor, 'price_mode', 'price_mode', OLD.price_mode, NEW.price_mode, NEW.symbol, NEW.position_type::text, v_source);
  END IF;

  IF v_source = 'broker' AND NEW.current_price IS DISTINCT FROM OLD.current_price THEN
    INSERT INTO position_audit_log(position_id, user_id, changed_by, change_type, field_name, old_value, new_value, symbol, position_type, source)
    VALUES (NEW.id, NEW.user_id, v_actor, 'current_price', 'current_price', OLD.current_price::text, NEW.current_price::text, NEW.symbol, NEW.position_type::text, v_source);
  END IF;

  IF v_source = 'broker' AND NEW.pnl IS DISTINCT FROM OLD.pnl THEN
    INSERT INTO position_audit_log(position_id, user_id, changed_by, change_type, field_name, old_value, new_value, symbol, position_type, source)
    VALUES (NEW.id, NEW.user_id, v_actor, 'pnl', 'pnl', OLD.pnl::text, NEW.pnl::text, NEW.symbol, NEW.position_type::text, v_source);
  END IF;

  IF NEW.entry_price IS DISTINCT FROM OLD.entry_price THEN
    INSERT INTO position_audit_log(position_id, user_id, changed_by, change_type, field_name, old_value, new_value, symbol, position_type, source)
    VALUES (NEW.id, NEW.user_id, v_actor, 'entry_price', 'entry_price', OLD.entry_price::text, NEW.entry_price::text, NEW.symbol, NEW.position_type::text, v_source);
  END IF;

  IF NEW.stop_loss IS DISTINCT FROM OLD.stop_loss THEN
    INSERT INTO position_audit_log(position_id, user_id, changed_by, change_type, field_name, old_value, new_value, symbol, position_type, source)
    VALUES (NEW.id, NEW.user_id, v_actor, 'stop_loss', 'stop_loss', OLD.stop_loss::text, NEW.stop_loss::text, NEW.symbol, NEW.position_type::text, v_source);
  END IF;

  IF NEW.take_profit IS DISTINCT FROM OLD.take_profit THEN
    INSERT INTO position_audit_log(position_id, user_id, changed_by, change_type, field_name, old_value, new_value, symbol, position_type, source)
    VALUES (NEW.id, NEW.user_id, v_actor, 'take_profit', 'take_profit', OLD.take_profit::text, NEW.take_profit::text, NEW.symbol, NEW.position_type::text, v_source);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO position_audit_log(position_id, user_id, changed_by, change_type, field_name, old_value, new_value, symbol, position_type, source)
    VALUES (NEW.id, NEW.user_id, v_actor, 'status', 'status', OLD.status::text, NEW.status::text, NEW.symbol, NEW.position_type::text, v_source);
  END IF;

  IF NEW.close_price IS DISTINCT FROM OLD.close_price THEN
    INSERT INTO position_audit_log(position_id, user_id, changed_by, change_type, field_name, old_value, new_value, symbol, position_type, source)
    VALUES (NEW.id, NEW.user_id, v_actor, 'close_price', 'close_price', OLD.close_price::text, NEW.close_price::text, NEW.symbol, NEW.position_type::text, v_source);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_position_changes
AFTER UPDATE ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.log_position_changes();
