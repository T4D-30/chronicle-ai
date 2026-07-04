# Chronicle AI — Deployment Guide

---

## Architecture Overview

```
Browser (React/Vite SPA)
    │
    ├── Supabase Client (auth, DB reads/writes)
    │       └── PostgreSQL (RLS enforced)
    │
    └── Supabase Edge Function: narrate
            └── OpenAI API (gpt-4o, streaming)
```

The app is a static SPA — the client bundle talks directly to Supabase for auth and database, and to the `narrate` Edge Function for AI narration. There is no separate Node.js backend.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20.x+ | https://nodejs.org |
| npm | 10.x+ | Bundled with Node |
| Supabase CLI | latest | `npm i -g supabase` |
| Git | any | https://git-scm.com |

---

## Supabase Project Setup

### 1. Create a Supabase project

1. Go to https://supabase.com and create a new project.
2. Note your **Project URL** and **anon key** (Settings > API).
3. Note your **Service role key** (only needed for local migration runs — never put in client).

### 2. Apply database migrations

From the project root:

```bash
# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Push all migrations (0001–0005)
supabase db push
```

Verify all migrations applied:
```sql
SELECT name FROM supabase_migrations.schema_migrations ORDER BY name;
-- Expected: 0001_initial_schema, 0002_characters, 0003_campaign_data,
--           0004_proficiencies_equipment, 0005_portrait_bio
```

### 3. Deploy the Edge Function

```bash
supabase functions deploy narrate
```

Set the OpenAI API key as a secret (never in env files):
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key-here
supabase secrets set AI_MAX_TOKENS=4096
supabase secrets set AI_MAX_REQUESTS_PER_USER_PER_MINUTE=10
```

Verify the function is deployed:
```bash
supabase functions list
```

### 4. Configure Authentication

In Supabase Dashboard > Authentication > URL Configuration:
1. Enable **Email** provider (Authentication > Providers).
2. Set **Site URL**:
   - If you have a custom domain: `https://chronicle-ai.app`
   - For a first public test-play deploy (no custom domain yet): your Vercel production URL, e.g. `https://your-app.vercel.app`
3. Add **Redirect URLs** (Authentication > URL Configuration > Redirect URLs) — add all that apply:
   - `https://your-app.vercel.app/**`
   - `https://your-app.vercel.app/auth/callback`
   - If you also want Vercel Preview deployments (PR builds) to support login, add: `https://your-app-*.vercel.app/**` (Vercel's preview URL pattern). Without this, auth will fail on preview links with a redirect mismatch error — a common first-deploy surprise.
   - When you later add a custom domain, add its URLs here too and update Site URL — old Vercel URLs can stay in the list, they just won't be used.
4. Configure email templates if using email confirmation (Authentication > Email Templates).

> ⚠️ **Most common playtest bug**: sign-up/login works locally but fails after deploy with "redirect_uri mismatch" or silently redirects to the wrong place. This is always a missing or mismatched entry in Redirect URLs above — the Site URL and every domain you actually deploy to must be listed exactly, including the trailing `/**`.

---

## Google OAuth Setup

Google Sign-In (`authService.signInWithGoogle()`, `src/lib/supabase/auth.ts`) is fully implemented and tested against a mocked client and a real local database (provisioning, RLS) — see `docs/ROADMAP.md`'s Phase 10.5 entry. It has **not** been exercised against a real Google OAuth consent screen in this development environment, because that requires credentials only a human with access to a real Google Cloud project and the live Supabase dashboard can create. No code changes are needed to go live — only the configuration below.

### 1. Create a Google Cloud OAuth client

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or select) a project.
2. Go to **APIs & Services > OAuth consent screen** and configure it (External user type is fine for most apps; internal-only requires a Google Workspace).
3. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Authorized redirect URIs: add your Supabase project's callback URL, in the exact form `https://<your-project-ref>.supabase.co/auth/v1/callback` — this is Supabase's own callback endpoint, not this app's `/auth/callback` route (that's a separate, second redirect — see step 3 below).
4. Save the generated **Client ID** and **Client Secret** — you'll need both in the next step.

### 2. Enable the provider in Supabase

1. In the Supabase dashboard: **Authentication > Providers > Google**.
2. Toggle it on, paste in the Client ID and Client Secret from step 1.
3. Save. Supabase now handles the actual OAuth handshake with Google server-side — this app's code never sees the client secret, and never needs to.

### 3. Confirm this app's own redirect URL is allow-listed

This app's `AuthCallbackPage` (`src/app/pages/AuthCallbackPage.tsx`) lives at `/auth/callback` and is where Supabase redirects back to *after* it finishes talking to Google. This URL must be present in **Authentication > URL Configuration > Redirect URLs** — the same list configured in the "Supabase Project Setup" section above (`https://your-app.vercel.app/**` already covers it via the wildcard; the explicit `/auth/callback` entry documented there is for clarity, not strictly required given the wildcard).

### 4. What requires no further configuration

- `authService.signInWithGoogle()` already builds `redirectTo` as `${window.location.origin}/auth/callback` dynamically — no hardcoded URL to update per environment.
- Automatic profile provisioning (migration `0007_google_oauth_provisioning.sql`) requires no dashboard configuration — it's a database trigger, already part of this repository's migration set, and applies the moment migrations are run against your real Supabase project.
- No new environment variables are needed beyond the existing `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.

### 5. Verifying it actually works

Once the above is configured, the full flow to test manually: click **Continue with Google** on `/login` or `/signup` → Google's real consent screen → redirected back to `/auth/callback` → briefly shows "Signing you in…" → lands on `/dashboard`. A first-time Google sign-in should also produce a new row in `public.profiles` with `display_name`/`avatar_url` populated from your Google account — confirms the provisioning trigger fired correctly against your real project, not just the local test database.

**This exact end-to-end flow was not run in this development environment** — every piece up to and including the real Google redirect has been built and tested (unit tests against a mocked OAuth client, integration tests against a real local Postgres database for the provisioning trigger and RLS), but the live round-trip through Google's actual consent screen requires the real credentials only a deploy with real Google Cloud + Supabase dashboard access can provide.

---

## Hosting (Vercel — recommended)

### 1. Connect repository

1. Push your code to GitHub/GitLab/Bitbucket.
2. Import project in Vercel dashboard.
3. Framework preset: **Vite**.
4. Build command: `npm run build`
5. Output directory: `dist`

### 2. Set environment variables

In Vercel > Project > Settings > Environment Variables, add:

```
VITE_SUPABASE_URL        = https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY   = your-anon-key
VITE_APP_NAME            = Chronicle AI
VITE_APP_VERSION         = 0.1.0
VITE_APP_ENV             = production
VITE_ENABLE_DEBUG_PANEL  = false
VITE_ENABLE_DEV_TOOLS    = false
VITE_ENABLE_MOCK_AI      = false
```

> ⚠️ **Never set `OPENAI_API_KEY` in Vercel.** It belongs only in Supabase Edge Function secrets.

### 3. Deploy

Push to `main` branch — Vercel deploys automatically.

```bash
git push origin main
```

### 4. Verify deployment

```bash
# Check build succeeded in Vercel dashboard
# Visit production URL
# Run smoke test from RELEASE_CHECKLIST.md section 9
```

---

## Hosting (Netlify — alternative)

1. Connect repository in Netlify dashboard.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Set the same environment variables as the Vercel section above.
5. > A `vercel.json` file is already in the project root with SPA rewrites, security headers, and immutable asset caching.

Add a `netlify.toml` for SPA routing:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Hosting (Cloudflare Pages — alternative)

1. Connect repository in Cloudflare Pages dashboard.
2. Build command: `npm run build`
3. Build output directory: `dist`
4. Set environment variables as above.
5. SPA routing handled automatically by Pages.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env.local
# Edit .env.local with your local Supabase credentials

# 3. Start local Supabase stack (Docker required)
supabase start

# 4. Apply migrations to local DB
supabase db push

# 5. Start dev server
npm run dev
```

### Local database scripts

```bash
npm run db:test:setup   # Create test DB user for integration tests
npm run db:types        # Regenerate supabase-generated.ts from live schema
npm run test:integration # Run integration tests against local Postgres
```

---

## Environment Variable Reference

### Client-side (`VITE_` prefix — included in the browser bundle)

| Variable | Description | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://abc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) | `eyJhbGci...` |
| `VITE_APP_NAME` | Display name | `Chronicle AI` |
| `VITE_APP_VERSION` | Semver | `0.1.0` |
| `VITE_APP_ENV` | `development` or `production` | `production` |
| `VITE_ENABLE_DEBUG_PANEL` | Show Debug Panel in AdventureHub | `false` |
| `VITE_ENABLE_DEV_TOOLS` | Enable React DevTools hooks | `false` |
| `VITE_ENABLE_MOCK_AI` | Use stub AI responses | `false` |

### Server-side (Supabase Edge Function secrets — never in client)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for `narrate` function |
| `AI_MAX_TOKENS` | Max tokens per narration call (default: 4096) |
| `AI_MAX_REQUESTS_PER_USER_PER_MINUTE` | Rate limit (default: 10) |

---

## Database Migrations

Migrations are applied in order. They are idempotent — safe to re-run.

| Migration | Description |
|---|---|
| `0001_initial_schema.sql` | profiles, campaigns, game_sessions, narrative_turns, RLS policies |
| `0002_characters.sql` | characters table with full stat block, FK to profiles |
| `0003_campaign_data.sql` | director_config + world_state JSONB on campaigns; mode tracking on sessions/turns |
| `0004_proficiencies_equipment.sql` | skill_proficiencies, saving_throw_proficiencies, equipment JSONB on characters |
| `0005_portrait_bio.sql` | portrait_url and bio columns on characters |

To apply a migration manually:
```bash
supabase db push           # Apply all pending migrations
# or
psql $DATABASE_URL -f supabase/migrations/0005_portrait_bio.sql
```

---

## Monitoring

### Error tracking (Sentry — recommended)

Install:
```bash
npm install @sentry/react
```

Add to `src/main.tsx`:
```typescript
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENV,
  // Do not send user PII
  beforeSend(event) {
    delete event.user
    return event
  },
})
```

Set `VITE_SENTRY_DSN` in your hosting environment variables.

### Supabase logs

- Database logs: Supabase Dashboard > Logs > Postgres
- Edge Function logs: Supabase Dashboard > Logs > Edge Functions
- Auth logs: Supabase Dashboard > Logs > Auth

### Uptime monitoring

Recommended: [Betterstack](https://betterstack.com) or [UptimeRobot](https://uptimerobot.com).
Monitor: `https://your-production-url.com/`

---

## Rollback

### Application rollback

Vercel: Go to Deployments > select previous deployment > "Promote to Production".
Netlify: Go to Deploys > select previous deployment > "Publish deploy".

### Database rollback

All migrations are additive (no destructive changes). To roll back a migration:
1. Review the migration file for the changes made.
2. Write a manual reversal SQL script.
3. Apply via `psql $DATABASE_URL`.

No automated `DOWN` scripts currently exist. This is acceptable for the alpha — add them before GA.

---

## CI/CD (GitHub Actions — optional but recommended)

The CI workflow is already created at `.github/workflows/ci.yml`. It runs on every push to `main` and every pull request.

**What it checks:**
- `npx tsc --noEmit` — zero TypeScript errors
- `npx vitest run` — all 1323+ unit tests with production feature flags
- `npm run build` — production bundle
- Bundle scan — fails if any OpenAI-style key is found in `dist/`

To customise, edit `.github/workflows/ci.yml` directly.

**Full workflow for reference:**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build
```

Add integration tests to CI with a Supabase test database if needed — see `docs/SETUP.md` for the integration test setup.

---

*Last updated: Phase 8.3 — Interactive DM Interface*
