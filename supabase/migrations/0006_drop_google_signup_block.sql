-- Undo 0005: Google on Create account must be allowed to insert a user.
-- Sign-in still rejects brand-new Google users in the auth callback.
drop trigger if exists reject_google_only_signup on auth.users;
drop function if exists public.reject_google_only_signup();
