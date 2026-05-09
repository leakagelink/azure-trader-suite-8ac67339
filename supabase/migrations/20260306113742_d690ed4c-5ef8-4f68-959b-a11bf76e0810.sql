ALTER TABLE public.kyc_submissions 
ADD COLUMN occupation_type text NULL,
ADD COLUMN business_type text NULL,
ADD COLUMN job_title text NULL,
ADD COLUMN annual_income text NULL;