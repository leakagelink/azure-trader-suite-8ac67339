
-- Remove direct wallet UPDATE by users; balance changes must go through SECURITY DEFINER functions
DROP POLICY IF EXISTS "Users can update own wallet" ON public.user_wallets;

-- Protect sensitive broker-controlled columns on profiles via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.is_approved   := OLD.is_approved;
    NEW.approved_by   := OLD.approved_by;
    NEW.approved_at   := OLD.approved_at;
    NEW.max_leverage  := OLD.max_leverage;
    NEW.client_id     := OLD.client_id;
    NEW.email         := OLD.email;
    NEW.mobile_number := OLD.mobile_number;
    NEW.id            := OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
