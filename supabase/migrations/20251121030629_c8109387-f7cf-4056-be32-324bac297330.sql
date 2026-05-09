-- Add price_mode column to positions table to track if trade follows live market or manual entry price
ALTER TABLE positions ADD COLUMN IF NOT EXISTS price_mode text DEFAULT 'live' CHECK (price_mode IN ('live', 'manual'));

COMMENT ON COLUMN positions.price_mode IS 'Determines if position follows live market prices or stays near entry price (±5%)';