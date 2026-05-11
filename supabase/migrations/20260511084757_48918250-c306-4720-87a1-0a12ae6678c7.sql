
-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing auth users missing one
INSERT INTO public.profiles (id, full_name, email, mobile_number, client_id)
SELECT
  u.id,
  u.raw_user_meta_data->>'full_name',
  u.email,
  u.raw_user_meta_data->>'mobile_number',
  public.generate_client_id()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill default user role for users missing any role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;
