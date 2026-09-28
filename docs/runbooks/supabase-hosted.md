# Runbook: setting up the hosted Supabase project

`supabase/config.toml` configures local Supabase only. The hosted project is set up once
by the owner, in the Supabase dashboard, to match it. Do this before the first deployment
that needs sign-in.

## Owner actions this covers

| ID | Action |
|---|---|
| A2 | Create the Supabase account and project |
| A4 | Create the email-sending account (Resend) |
| A11 | Create a Google OAuth client, if sign-in with Google is wanted |
| A12 | Create a Cloudflare Turnstile widget for the site |

A11 and A12 were added in step 2. They are not in the plan's first list of owner actions.

## 1. Project and keys

1. Create a project on the free tier. Choose the region nearest to your users.
2. From **Project settings, API keys**, copy into the host's environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key. Server only. Never give it a `NEXT_PUBLIC_` name. |
| `NEXT_PUBLIC_SITE_URL` | The app's public address |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | From step 4 below |
| `OWNER_EMAIL` | Your own address, so you can register while sign-up is closed |
| `GOOGLE_SIGN_IN` | `true` only after step 5 below |

## 2. Database

Apply the migrations:

```
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

## 3. Authentication settings

| Setting | Value | Why |
|---|---|---|
| Site URL | The app's public address | Links in emails |
| Redirect URLs | `<site>/**` | Email links and the Google callback |
| Confirm email | On | Sign-up needs a confirmed address |
| Secure password change | On | |
| Minimum password length | 10 | Matches the form |
| Anonymous sign-ins | Off | |
| Hook: before user created | Postgres function `public.hook_before_user_created` | **The sign-up switch. Without it anyone can register.** |
| SMTP | Resend's SMTP settings | Supabase's built-in mail allows about 2 messages an hour |
| Email templates | Copy `supabase/templates/confirmation.html` and `recovery.html` | The links must lead to `/auth/confirm` with `token_hash` |
| Rate limits | Raise "sign-ups and sign-ins" well above the default | All requests reach Supabase from the server's address |

## 4. Bot check

1. In Cloudflare, create a Turnstile widget for the site's domain.
2. Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. In Supabase, **Authentication, Attack protection**, turn on CAPTCHA, choose
   Turnstile, and paste the secret key.

The keys in `.env.example` and `supabase/.env.example` are Cloudflare's published test
keys. They always pass. Never use them on the hosted project.

## 5. Sign-in with Google (optional)

1. In Google Cloud, create an OAuth client of type "Web application". Its authorised
   redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In Supabase, **Authentication, Providers, Google**, paste the client id and secret.
3. Set `GOOGLE_SIGN_IN=true` on the host.

## 6. Check it

1. Open `/sign-up`. The notice says sign-up is not open yet.
2. Register with a made-up address. It is refused with "Sign-up is closed".
3. Register with `OWNER_EMAIL`. A confirmation email arrives.
4. Press the button in the email. You land in the studio.

## Opening and closing sign-up

In the SQL editor:

```sql
select public.set_signup_open(true);   -- open to everyone
select public.set_signup_open(false);  -- closed again
select public.allow_signup_email('person@brand.com', 'invited by the owner');
```
