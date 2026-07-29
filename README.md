# Crazy Sajangnim Admin

Admin dashboard for the Crazy Sajangnim site. Google sign-in, restricted
to emails on the shared `admin_emails` allowlist.

## What it does

- **Users** — every site account (username, created, last login).
  Passwords are stored as one-way scrypt hashes and cannot be viewed;
  admins can issue a one-time temporary password or delete an account.
- **Admins** — add or remove the Gmail addresses allowed to sign in
  here. Removal takes effect on the person's next request.

## Setup

1. **Database** — run `supabase/auth.sql` from the main
   `crazy_sajangnim` repository in the Supabase SQL editor (creates
   `site_users`, `site_sessions`, `admin_emails`, and seeds the first
   admin email).
2. **Google OAuth** — in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   create an OAuth client ID (type *Web application*) and add the
   redirect URI `http://localhost:3001/api/auth/callback/google`
   (plus `https://YOUR-DOMAIN/api/auth/callback/google` after deploy).
   Put the client ID/secret into `.env.local` as `AUTH_GOOGLE_ID` /
   `AUTH_GOOGLE_SECRET`.
3. **Env** — `.env.local` needs `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` (same project as the main site),
   `AUTH_SECRET` (any random string), and the two Google values.

## Run

```bash
npm install
npm run dev
```

Runs on http://localhost:3001 (the main site uses 3000).

## Deploy

Deploy as its own Vercel project. Set the same four env vars, and add
the production callback URL to the Google OAuth client. Also set
`AUTH_TRUST_HOST=true` if deploying behind a proxy other than Vercel.
