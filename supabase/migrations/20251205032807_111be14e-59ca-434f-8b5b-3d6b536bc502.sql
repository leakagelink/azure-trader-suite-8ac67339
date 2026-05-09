-- Insert qr_code_url setting if it doesn't exist
INSERT INTO payment_settings (setting_key, setting_value)
VALUES ('qr_code_url', '')
ON CONFLICT (setting_key) DO NOTHING;