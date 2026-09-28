-- A password chosen before an address is confirmed does not survive confirmation.
--
-- Supabase Auth lets anyone register an address together with a password. Someone
-- could register another person's address with a password of their own choosing, wait
-- for the real owner to press "confirm" in the email, and then sign in with that
-- password. This was reproduced on 2026-09-29, see docs/decisions/0003.
--
-- The app registers by email alone and asks for a password after the address is
-- confirmed. This trigger makes the rule hold for every other caller too, including
-- anyone who calls Supabase Auth directly with the publishable key: at the moment an
-- address becomes confirmed, whatever password the account carried is removed. Only
-- someone who can read the mailbox can then choose one.

create function private.clear_password_on_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    new.encrypted_password := null;
  end if;
  return new;
end;
$$;

revoke all on function private.clear_password_on_confirmation()
  from public, anon, authenticated;

create trigger clear_password_on_confirmation
  before update of email_confirmed_at on auth.users
  for each row
  execute function private.clear_password_on_confirmation();
