-- Create storage bucket for payment QR codes
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-qrcodes', 'payment-qrcodes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload QR codes
CREATE POLICY "Admins can upload QR codes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-qrcodes' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update QR codes
CREATE POLICY "Admins can update QR codes"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-qrcodes' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to delete QR codes
CREATE POLICY "Admins can delete QR codes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-qrcodes' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow public read access for QR codes (needed for deposit modal)
CREATE POLICY "Public can view QR codes"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-qrcodes');