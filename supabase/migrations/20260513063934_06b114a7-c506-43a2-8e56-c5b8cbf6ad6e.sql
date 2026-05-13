-- Add per-user leverage cap on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS max_leverage integer;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_max_leverage_range;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_max_leverage_range
CHECK (max_leverage IS NULL OR (max_leverage >= 1 AND max_leverage <= 100));

-- Seed global default in payment_settings
INSERT INTO public.payment_settings (setting_key, setting_value)
VALUES ('max_leverage', '100')
ON CONFLICT (setting_key) DO NOTHING;