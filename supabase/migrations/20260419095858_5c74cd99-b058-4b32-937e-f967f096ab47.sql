UPDATE auth.users
SET encrypted_password = crypt('Madhav@123', gen_salt('bf')),
    updated_at = now()
WHERE email = 'maddymadhav@gmail.com';