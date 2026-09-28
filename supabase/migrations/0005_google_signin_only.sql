-- Google is sign-in only. Email/password creates the account.
-- Identity linking (same email, later Google) updates the existing row and does not hit this insert.
create or replace function public.reject_google_only_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data->>'provider', '') = 'google' then
    raise exception 'Sign in with Google is only for existing accounts. Create an account first.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_google_only_signup on auth.users;
create trigger reject_google_only_signup
  before insert on auth.users
  for each row
  execute procedure public.reject_google_only_signup();
