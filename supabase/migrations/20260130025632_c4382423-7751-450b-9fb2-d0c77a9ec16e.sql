-- Add stop_loss column to positions table
ALTER TABLE public.positions 
ADD COLUMN stop_loss numeric DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.positions.stop_loss IS 'Stop loss price - position will auto-close when current price reaches this level';