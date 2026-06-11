ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS income_proof_type TEXT,
  ADD COLUMN IF NOT EXISTS income_proof_url TEXT;