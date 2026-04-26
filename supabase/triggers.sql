-- Trigger to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_app_secret TEXT;
  v_signup_method TEXT;
  v_inserted_id UUID;
BEGIN
  v_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_app_secret := trim(coalesce(new.raw_user_meta_data->>'app_secret', ''));
  v_signup_method := lower(trim(coalesce(new.raw_user_meta_data->>'signup_method', 'email')));

  IF v_signup_method = 'app_secret' THEN
    IF v_username = '' THEN
      RAISE EXCEPTION 'Username is required';
    END IF;

    IF v_username !~ '^[a-z0-9._-]{3,30}$' THEN
      RAISE EXCEPTION 'Username must be 3-30 chars and only contain letters, numbers, dot, underscore, hyphen';
    END IF;

    IF v_app_secret = '' THEN
      RAISE EXCEPTION 'App secret is required';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.users u
      WHERE lower(coalesce(u.username, '')) = v_username
    ) THEN
      RAISE EXCEPTION 'Username is already taken';
    END IF;

    UPDATE public.app_signup_secrets s
    SET used_count = s.used_count + 1
    WHERE s.secret_key = v_app_secret
      AND s.is_active = true
      AND s.expires_at > now()
      AND s.used_count < s.max_uses
    RETURNING s.id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.app_signup_secrets s
        WHERE s.secret_key = v_app_secret
          AND s.is_active = true
          AND s.expires_at <= now()
      ) THEN
        RAISE EXCEPTION 'App secret has expired';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.app_signup_secrets s
        WHERE s.secret_key = v_app_secret
          AND s.is_active = true
          AND s.used_count >= s.max_uses
      ) THEN
        RAISE EXCEPTION 'App secret usage limit reached';
      END IF;

      RAISE EXCEPTION 'Invalid app secret';
    END IF;

    update auth.users
    set
      email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = new.id;
  ELSE
    v_username := null;
  END IF;

  INSERT INTO public.users (id, name, username)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(COALESCE(new.email, ''), '@', 1),
      'User'
    ),
    v_username
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill users that already exist in auth.users but are missing in public.users
INSERT INTO public.users (id, name, username)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.email),
  nullif(lower(trim(coalesce(au.raw_user_meta_data->>'username', split_part(coalesce(au.email, ''), '@', 1)))), '')
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT DO NOTHING;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
