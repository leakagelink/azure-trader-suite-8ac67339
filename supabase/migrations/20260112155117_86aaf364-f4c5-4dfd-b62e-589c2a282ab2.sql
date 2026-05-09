-- Create a security definer function for admin manual KYC submission
CREATE OR REPLACE FUNCTION public.admin_submit_kyc(
  p_user_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_date_of_birth DATE,
  p_country TEXT,
  p_address TEXT,
  p_city TEXT,
  p_postal_code TEXT,
  p_id_document_type TEXT,
  p_document_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kyc_id UUID;
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can submit manual KYC';
  END IF;
  
  -- Check if user already has a KYC submission
  IF EXISTS (SELECT 1 FROM kyc_submissions WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already has a KYC submission';
  END IF;
  
  -- Insert the KYC submission with approved status
  INSERT INTO kyc_submissions (
    user_id,
    first_name,
    last_name,
    date_of_birth,
    country,
    address,
    city,
    postal_code,
    id_document_type,
    document_url,
    status,
    reviewed_at,
    reviewed_by
  ) VALUES (
    p_user_id,
    p_first_name,
    p_last_name,
    p_date_of_birth,
    p_country,
    p_address,
    p_city,
    p_postal_code,
    p_id_document_type,
    p_document_url,
    'approved',
    now(),
    auth.uid()
  )
  RETURNING id INTO v_kyc_id;
  
  RETURN v_kyc_id;
END;
$$;