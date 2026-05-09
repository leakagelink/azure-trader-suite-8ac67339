-- Create table for payment settings
CREATE TABLE public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view payment settings"
  ON public.payment_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payment settings"
  ON public.payment_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Insert default payment settings
INSERT INTO public.payment_settings (setting_key, setting_value) VALUES
  ('upi_id', 'tradepro@upi'),
  ('account_name', 'TradePro Account'),
  ('account_number', '1234567890'),
  ('ifsc_code', 'BANK0001234'),
  ('bank_name', 'Demo Bank');

-- Create trigger for updated_at
CREATE TRIGGER update_payment_settings_updated_at
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();