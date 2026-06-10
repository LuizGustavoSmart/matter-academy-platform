
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role (no auth.uid) and admins to make any change
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.invite_token IS DISTINCT FROM OLD.invite_token
     OR NEW.invite_expires_at IS DISTINCT FROM OLD.invite_expires_at
     OR NEW.reset_token IS DISTINCT FROM OLD.reset_token
     OR NEW.reset_expires_at IS DISTINCT FROM OLD.reset_expires_at
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile columns';
  END IF;
  RETURN NEW;
END;
$$;

-- Fix the user that got stuck in pending due to the previous bug
UPDATE public.profiles
SET status = 'active',
    invite_token = NULL,
    invite_expires_at = NULL,
    activated_at = COALESCE(activated_at, now())
WHERE email = 'pedroreserva2003@gmail.com' AND status = 'pending';
