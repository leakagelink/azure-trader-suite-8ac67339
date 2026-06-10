
DROP POLICY IF EXISTS "System can insert audit log" ON public.position_audit_log;
CREATE POLICY "Brokers can insert audit log"
ON public.position_audit_log
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own wallet" ON public.user_wallets;
CREATE POLICY "Users can insert own wallet"
ON public.user_wallets
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.wallet_transactions;

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Brokers can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Brokers can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Brokers can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view payment proofs" ON storage.objects;
CREATE POLICY "Owners and Brokers can view payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND ((auth.uid())::text = (storage.foldername(name))[1]
       OR public.has_role(auth.uid(), 'admin'::app_role))
);
CREATE POLICY "Owners and Brokers can delete payment proofs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND ((auth.uid())::text = (storage.foldername(name))[1]
       OR public.has_role(auth.uid(), 'admin'::app_role))
);

REVOKE EXECUTE ON FUNCTION public.admin_clear_user_trade_history(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_position(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_submit_kyc(uuid, text, text, date, text, text, text, text, text, text, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_submit_kyc(uuid, text, text, date, text, text, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_deposit(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_kyc(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_user(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_edited_positions_consistency() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.drift_edited_positions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_active_api_key(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_deposit(uuid, numeric, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_deposit(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_kyc(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stress_test_price_mode_toggling(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_client_id() FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_deposit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_kyc(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_kyc(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_submit_kyc(uuid, text, text, date, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_submit_kyc(uuid, text, text, date, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_clear_user_trade_history(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_position(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_edited_positions_consistency() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stress_test_price_mode_toggling(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lock_deposit(uuid, numeric, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_api_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.drift_edited_positions() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;
