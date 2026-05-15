
CREATE OR REPLACE FUNCTION public.admin_delete_position(p_position_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status position_status;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only Brokers can delete trades';
  END IF;

  SELECT status INTO v_status FROM positions WHERE id = p_position_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found';
  END IF;
  IF v_status <> 'closed' THEN
    RAISE EXCEPTION 'Only closed trades can be deleted';
  END IF;

  DELETE FROM position_audit_log WHERE position_id = p_position_id;
  DELETE FROM positions WHERE id = p_position_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_user_trade_history(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only Brokers can clear trade history';
  END IF;

  DELETE FROM position_audit_log
  WHERE position_id IN (
    SELECT id FROM positions WHERE user_id = p_user_id AND status = 'closed'
  );

  WITH deleted AS (
    DELETE FROM positions
    WHERE user_id = p_user_id AND status = 'closed'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;
