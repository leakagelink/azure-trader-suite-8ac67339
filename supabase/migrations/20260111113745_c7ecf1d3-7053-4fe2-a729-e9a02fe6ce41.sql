-- Create storage bucket for app files
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-files', 'app-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for app files bucket
CREATE POLICY "Anyone can view app files"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-files');

CREATE POLICY "Admins can upload app files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'app-files' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update app files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'app-files' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete app files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'app-files' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Add app_download_url to payment_settings if not exists
INSERT INTO payment_settings (setting_key, setting_value, updated_at)
VALUES ('app_download_url', '', now())
ON CONFLICT (setting_key) DO NOTHING;