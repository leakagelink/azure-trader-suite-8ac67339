ALTER TABLE public.positions 
ADD COLUMN take_profit numeric DEFAULT NULL;

COMMENT ON COLUMN public.positions.take_profit IS 'Take profit price - position will auto-close when current price reaches this level';