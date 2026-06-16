
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_sensitive_changes() FROM PUBLIC, anon, authenticated;
