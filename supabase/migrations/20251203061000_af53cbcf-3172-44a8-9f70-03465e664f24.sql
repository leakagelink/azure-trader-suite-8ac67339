-- Create KYC status enum
CREATE TYPE public.kyc_status AS ENUM ('pending', 'approved', 'rejected');

-- Create KYC submissions table
CREATE TABLE public.kyc_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  country TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  id_document_type TEXT NOT NULL,
  document_url TEXT,
  status kyc_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own KYC submission
CREATE POLICY "Users can view own KYC submission"
ON public.kyc_submissions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own KYC submission
CREATE POLICY "Users can insert own KYC submission"
ON public.kyc_submissions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending KYC submission
CREATE POLICY "Users can update own pending KYC submission"
ON public.kyc_submissions
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all KYC submissions
CREATE POLICY "Admins can view all KYC submissions"
ON public.kyc_submissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update KYC submissions
CREATE POLICY "Admins can update KYC submissions"
ON public.kyc_submissions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create function to approve KYC
CREATE OR REPLACE FUNCTION public.approve_kyc(kyc_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve KYC';
  END IF;

  UPDATE public.kyc_submissions
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  WHERE id = kyc_id;
END;
$$;

-- Create function to reject KYC
CREATE OR REPLACE FUNCTION public.reject_kyc(kyc_id UUID, reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject KYC';
  END IF;

  UPDATE public.kyc_submissions
  SET 
    status = 'rejected',
    rejection_reason = reason,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  WHERE id = kyc_id;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_kyc_submissions_updated_at
BEFORE UPDATE ON public.kyc_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();