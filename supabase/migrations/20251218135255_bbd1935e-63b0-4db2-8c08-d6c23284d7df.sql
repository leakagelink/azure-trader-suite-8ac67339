-- Drop the existing check constraint
ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS positions_price_mode_check;

-- Add new check constraint that includes 'edited'
ALTER TABLE public.positions ADD CONSTRAINT positions_price_mode_check 
CHECK (price_mode IN ('live', 'manual', 'edited'));