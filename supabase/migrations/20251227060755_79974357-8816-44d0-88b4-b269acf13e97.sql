-- Add deposit offer settings to payment_settings table
INSERT INTO public.payment_settings (setting_key, setting_value)
VALUES 
  ('deposit_bonus_enabled', 'true'),
  ('deposit_bonus_percentage', '30'),
  ('deposit_min_amount', '200'),
  ('deposit_max_amount', '2000'),
  ('deposit_bonus_max', '600'),
  ('deposit_offer_title', 'Christmas Bonus')
ON CONFLICT (setting_key) DO NOTHING;