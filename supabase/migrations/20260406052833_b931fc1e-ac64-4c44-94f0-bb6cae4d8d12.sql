
CREATE OR REPLACE FUNCTION public.admin_submit_kyc(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_country text,
  p_address text,
  p_city text,
  p_postal_code text,
  p_id_document_type text,
  p_document_url text DEFAULT NULL,
  p_occupation_type text DEFAULT NULL,
  p_business_type text DEFAULT NULL,
  p_job_title text DEFAULT NULL,
  p_annual_income text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kyc_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can submit manual KYC';
  END IF;
  
  IF EXISTS (SELECT 1 FROM kyc_submissions WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already has a KYC submission';
  END IF;
  
  INSERT INTO kyc_submissions (
    user_id, first_name, last_name, date_of_birth, country,
    address, city, postal_code, id_document_type, document_url,
    occupation_type, business_type, job_title, annual_income,
    status, reviewed_at, reviewed_by
  ) VALUES (
    p_user_id, p_first_name, p_last_name, p_date_of_birth, p_country,
    p_address, p_city, p_postal_code, p_id_document_type, p_document_url,
    p_occupation_type, p_business_type, p_job_title, p_annual_income,
    'approved', now(), auth.uid()
  )
  RETURNING id INTO v_kyc_id;
  
  RETURN v_kyc_id;
END;
$$;
