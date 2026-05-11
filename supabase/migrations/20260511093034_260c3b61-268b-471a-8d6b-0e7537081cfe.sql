
CREATE OR REPLACE FUNCTION public.stress_test_price_mode_toggling(p_iterations INT DEFAULT 200)
RETURNS TABLE (
  iterations INT,
  passed INT,
  failed INT,
  guard_violations INT,
  pnl_violations INT,
  drift_violations INT,
  duration_ms INT,
  sample_violations TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos_id UUID;
  v_caller UUID := auth.uid();
  v_start TIMESTAMPTZ := clock_timestamp();
  v_iter INT;
  v_passed INT := 0;
  v_failed INT := 0;
  v_guard_v INT := 0;
  v_pnl_v INT := 0;
  v_drift_v INT := 0;
  v_violations TEXT[] := ARRAY[]::TEXT[];
  v_rows_affected INT;
  v_actual_price NUMERIC;
  v_actual_pnl NUMERIC;
  v_expected_pnl NUMERIC;
  v_amount NUMERIC := 1;
  v_entry NUMERIC := 100;
  v_target NUMERIC;
  v_pre_price NUMERIC;
  v_post_price NUMERIC;
BEGIN
  IF NOT has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only Brokers can run stress tests';
  END IF;

  IF p_iterations < 10 OR p_iterations > 2000 THEN
    RAISE EXCEPTION 'iterations must be between 10 and 2000';
  END IF;

  -- Create sandbox position owned by the caller (Broker), short symbol so no live feed touches it
  INSERT INTO positions (
    user_id, symbol, position_type, amount, entry_price, current_price,
    leverage, margin, pnl, status, price_mode, momentum_active
  ) VALUES (
    v_caller, '__STRESS_TEST__', 'long', v_amount, v_entry, v_entry,
    1, v_entry, 0, 'open', 'live', false
  ) RETURNING id INTO v_pos_id;

  BEGIN
    FOR v_iter IN 1..p_iterations LOOP
      ----------------------------------------------------------------
      -- PHASE A: switch to EDITED, then attempt a "live" write that
      -- must be rejected by the price_mode guard.
      ----------------------------------------------------------------
      v_target := v_entry + (v_iter % 10);
      UPDATE positions
        SET price_mode = 'edited',
            current_price = v_target,
            pnl = (v_target - v_entry) * v_amount,
            updated_at = now()
        WHERE id = v_pos_id;

      -- Simulate a racing live-feed write (uses the guard from Positions.tsx)
      UPDATE positions
        SET current_price = 99999,
            pnl = 99999,
            updated_at = now()
        WHERE id = v_pos_id
          AND status = 'open'
          AND price_mode <> 'edited';
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

      SELECT current_price, pnl INTO v_actual_price, v_actual_pnl
        FROM positions WHERE id = v_pos_id;

      IF v_rows_affected <> 0 OR v_actual_price = 99999 THEN
        v_guard_v := v_guard_v + 1;
        v_failed := v_failed + 1;
        IF array_length(v_violations, 1) IS NULL OR array_length(v_violations, 1) < 5 THEN
          v_violations := v_violations || format('iter %s: live write leaked into edited row (price=%s)', v_iter, v_actual_price);
        END IF;
      ELSIF v_actual_price <> v_target THEN
        v_drift_v := v_drift_v + 1;
        v_failed := v_failed + 1;
        IF array_length(v_violations, 1) IS NULL OR array_length(v_violations, 1) < 5 THEN
          v_violations := v_violations || format('iter %s: edited price mutated unexpectedly (%s -> %s)', v_iter, v_target, v_actual_price);
        END IF;
      ELSE
        v_expected_pnl := (v_actual_price - v_entry) * v_amount;
        IF abs(v_actual_pnl - v_expected_pnl) > 0.0001 THEN
          v_pnl_v := v_pnl_v + 1;
          v_failed := v_failed + 1;
          IF array_length(v_violations, 1) IS NULL OR array_length(v_violations, 1) < 5 THEN
            v_violations := v_violations || format('iter %s: pnl mismatch stored=%s expected=%s', v_iter, v_actual_pnl, v_expected_pnl);
          END IF;
        ELSE
          v_passed := v_passed + 1;
        END IF;
      END IF;

      ----------------------------------------------------------------
      -- PHASE B: switch back to LIVE, then attempt an "edited" cron-style
      -- write that must be rejected by the inverse guard.
      ----------------------------------------------------------------
      v_target := v_entry + ((v_iter * 3) % 10);
      UPDATE positions
        SET price_mode = 'live',
            current_price = v_target,
            pnl = (v_target - v_entry) * v_amount,
            updated_at = now()
        WHERE id = v_pos_id;

      v_pre_price := v_target;

      -- Simulate cron drift attempting to touch a non-edited row
      UPDATE positions
        SET current_price = -1,
            pnl = -1,
            updated_at = now()
        WHERE id = v_pos_id
          AND status = 'open'
          AND price_mode = 'edited';
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

      SELECT current_price INTO v_post_price FROM positions WHERE id = v_pos_id;

      IF v_rows_affected <> 0 OR v_post_price = -1 THEN
        v_guard_v := v_guard_v + 1;
        v_failed := v_failed + 1;
        IF array_length(v_violations, 1) IS NULL OR array_length(v_violations, 1) < 5 THEN
          v_violations := v_violations || format('iter %s: cron drift leaked into live row (price=%s)', v_iter, v_post_price);
        END IF;
      ELSIF v_post_price <> v_pre_price THEN
        v_drift_v := v_drift_v + 1;
        v_failed := v_failed + 1;
      ELSE
        v_passed := v_passed + 1;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM positions WHERE id = v_pos_id;
    RAISE;
  END;

  -- Cleanup sandbox + its audit rows
  DELETE FROM position_audit_log WHERE position_id = v_pos_id;
  DELETE FROM positions WHERE id = v_pos_id;

  RETURN QUERY SELECT
    p_iterations,
    v_passed,
    v_failed,
    v_guard_v,
    v_pnl_v,
    v_drift_v,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INT,
    v_violations;
END;
$$;
