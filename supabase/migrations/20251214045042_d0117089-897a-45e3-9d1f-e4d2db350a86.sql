-- Allow authenticated users to view payment settings (read-only)
CREATE POLICY "Authenticated users can view payment settings" 
ON public.payment_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);