-- Add client_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mobile_number ON public.profiles(mobile_number);

-- Function to generate unique client ID
CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate ID: CGF + 6 random digits
    new_id := 'CGF' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE client_id = new_id) INTO id_exists;
    
    -- Exit if unique
    IF NOT id_exists THEN
      RETURN new_id;
    END IF;
  END LOOP;
END;
$$;

-- Update handle_new_user function to generate client_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, mobile_number, client_id)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'mobile_number',
    generate_client_id()
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

-- Generate client_id for existing users who don't have one
UPDATE public.profiles 
SET client_id = generate_client_id() 
WHERE client_id IS NULL;