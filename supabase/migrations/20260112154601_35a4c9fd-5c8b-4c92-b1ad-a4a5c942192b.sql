-- Drop existing restrictive policies on kyc_submissions
DROP POLICY IF EXISTS "Users can view own KYC submission" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Users can insert own KYC submission" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Users can update own pending KYC submission" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Admins can view all KYC submissions" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Admins can update KYC submissions" ON public.kyc_submissions;

-- Recreate policies as PERMISSIVE (default)
-- Users can view their own KYC submission
CREATE POLICY "Users can view own KYC submission"
ON public.kyc_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own KYC submission
CREATE POLICY "Users can insert own KYC submission"
ON public.kyc_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own KYC submission (when pending or rejected - for resubmission)
CREATE POLICY "Users can update own KYC submission"
ON public.kyc_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status IN ('pending', 'rejected'))
WITH CHECK (auth.uid() = user_id);

-- Admins can view all KYC submissions
CREATE POLICY "Admins can view all KYC submissions"
ON public.kyc_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any KYC submission
CREATE POLICY "Admins can update KYC submissions"
ON public.kyc_submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert KYC for manual submissions
CREATE POLICY "Admins can insert KYC for users"
ON public.kyc_submissions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));