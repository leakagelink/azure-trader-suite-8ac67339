
-- Add payment proof column
ALTER TABLE public.deposit_requests
ADD COLUMN IF NOT EXISTS payment_proof_url text;

-- Create public bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');

CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
