
CREATE OR REPLACE FUNCTION public.drift_edited_positions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pos RECORD;
  step numeric;
  new_price numeric;
  reached boolean;
  new_target numeric;
  pct numeric;
  price_diff numeric;
  new_pnl numeric;
  eff_direction text;
  eff_target numeric;
BEGIN
  -- Auto-initialize any edited+open row missing momentum metadata so drift can run.
  UPDATE public.positions p
  SET
    momentum_active = true,
    momentum_direction = COALESCE(
      p.momentum_direction,
      CASE WHEN p.position_type = 'long' THEN 'up' ELSE 'down' END
    ),
    momentum_target_price = COALESCE(
      p.momentum_target_price,
      CASE
        WHEN COALESCE(p.position_type::text,'long') = 'long'
          THEN p.current_price * (1 + ((1 + random() * 4) / 100.0))
        ELSE p.current_price * (1 - ((1 + random() * 4) / 100.0))
      END
    )
  WHERE p.status = 'open'
    AND p.price_mode = 'edited'
    AND (
      p.momentum_active IS NOT TRUE
      OR p.momentum_target_price IS NULL
      OR p.momentum_direction IS NULL
      OR p.momentum_direction NOT IN ('up','down')
    );

  FOR pos IN
    SELECT * FROM public.positions
    WHERE status = 'open'
      AND price_mode = 'edited'
      AND momentum_active = true
      AND momentum_target_price IS NOT NULL
      AND momentum_direction IN ('up','down')
  LOOP
    step := (pos.momentum_target_price - pos.current_price) * 0.08;
    new_price := pos.current_price + step;

    reached := abs(pos.momentum_target_price - new_price) <= abs(pos.momentum_target_price) * 0.0005;

    IF reached THEN
      new_price := pos.momentum_target_price;
      pct := (1 + random() * 4) / 100.0;
      IF pos.momentum_direction = 'up' THEN
        new_target := new_price * (1 + pct);
      ELSE
        new_target := new_price * (1 - pct);
      END IF;
    ELSE
      new_target := pos.momentum_target_price;
    END IF;

    IF pos.position_type = 'long' THEN
      price_diff := new_price - pos.entry_price;
    ELSE
      price_diff := pos.entry_price - new_price;
    END IF;
    new_pnl := price_diff * pos.amount;

    UPDATE public.positions
    SET current_price = new_price,
        momentum_target_price = new_target,
        pnl = new_pnl,
        updated_at = now()
    WHERE id = pos.id;
  END LOOP;
END;
$$;

-- Run once now to immediately activate + drift any existing edited trades.
SELECT public.drift_edited_positions();
