# Chronicle AI — Public Test Play: Go-Live Checklist

One linear path from a clean clone to a URL you can hand to playtesters.
Each step links to the detailed reference in `DEPLOYMENT.md` if you need
more context — this doc is the short version, in order, no branching.

Estimated time: 20–30 minutes if you already have Supabase and Vercel accounts.

---

## 0. Prerequisites

- [ ] Supabase account + CLI installed: `npm i -g supabase`
- [ ] Vercel account (or Netlify/Cloudflare Pages — adjust step 5 accordingly)
- [ ] An OpenAI API key (`sk-...`) — [platform.openai.com](https://platform.openai.com)
- [ ] Repo pushed to GitHub/GitLab/Bitbucket

---

## 1. Create the Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Name it, set a database password (save it), pick a region
3. Wait ~2 minutes for provisioning
4. Copy from **Settings > API**:
   - Project URL
   - `anon` public key

*(Full detail: `DEPLOYMENT.md` → Supabase Project Setup → step 1)*

---

## 2. Push the database schema

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Verify it worked:
```sql
-- Run in Supabase Dashboard > SQL Editor
SELECT name FROM supabase_migrations.schema_migrations ORDER BY name;
```
Expect 5 rows: `0001_initial_schema` through `0005_portrait_bio`.

*(Full detail: `DEPLOYMENT.md` → Supabase Project Setup → step 2)*

---

## 3. Deploy the AI Director Edge Function

```bash
supabase functions deploy narrate
```

Verify it's live:
```bash
supabase functions list
# Expect: narrate | active
```

*(Full detail: `DEPLOYMENT.md` → Supabase Project Setup → step 3)*

---

## 4. Set the OpenAI key as a Supabase secret

**This key must never go in Vercel or any `VITE_*` variable.** It is read
only inside the Edge Function via `Deno.env.get('OPENAI_API_KEY')` — the
browser never sees it.

```bash
supabase secrets set OPENAI_API_KEY=sk-your-real-key-here
supabase secrets set AI_MAX_TOKENS=4096
supabase secrets set AI_MAX_REQUESTS_PER_USER_PER_MINUTE=10
```

Verify (lists names only, never values):
```bash
supabase secrets list
```

---

## 5. Deploy the frontend to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new)
2. Framework preset: **Vite** (auto-detected)
3. Add these environment variables (Settings > Environment Variables, scope: Production):

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | from step 1 |
   | `VITE_SUPABASE_ANON_KEY` | from step 1 |
   | `VITE_APP_NAME` | `Chronicle AI` |
   | `VITE_APP_VERSION` | `0.1.0` |
   | `VITE_APP_ENV` | `production` |
   | `VITE_ENABLE_DEBUG_PANEL` | `false` |
   | `VITE_ENABLE_DEV_TOOLS` | `false` |
   | `VITE_ENABLE_MOCK_AI` | `false` |

   > ⚠️ Do **not** add `OPENAI_API_KEY` here. If it's in this list, remove it — it belongs only in step 4.

4. Deploy. Note the URL Vercel gives you, e.g. `https://your-app.vercel.app`.

---

## 6. Configure Supabase Auth redirect URLs

This step is the #1 cause of "it works locally but not for my testers."

In Supabase Dashboard > Authentication > URL Configuration:

1. **Site URL**: your Vercel URL from step 5, e.g. `https://your-app.vercel.app`
2. **Redirect URLs** — add:
   ```
   https://your-app.vercel.app/**
   https://your-app.vercel.app/auth/callback
   ```
3. If testers might click links from Vercel **Preview** deployments (PR builds), also add:
   ```
   https://your-app-*.vercel.app/**
   ```
4. Save.

If you add a custom domain later, add its URLs here too and update Site URL —
you don't need to remove the Vercel URL entries.

*(Full detail: `DEPLOYMENT.md` → Supabase Project Setup → step 4)*

---

## 7. Smoke test before sending the link

Open the deployed URL in an incognito window and walk through:

- [ ] Landing page loads
- [ ] Sign up with a real email → redirected correctly (this is what step 6 protects)
- [ ] Log in
- [ ] Create a character (full wizard)
- [ ] Create a campaign, assign the character
- [ ] Begin Adventure → type an action → AI narration streams back
- [ ] Trigger a combat encounter → attack resolves, HP updates, damage numbers appear
- [ ] Refresh the page mid-session → session resumes correctly
- [ ] Open browser DevTools > Network — confirm no request contains `sk-` anywhere in headers/body sent from the browser (the OpenAI key should never appear client-side)

If narration doesn't stream back: check Supabase Dashboard > Edge Functions >
Logs > narrate for the error — almost always a missing/wrong `OPENAI_API_KEY`
secret (step 4) or an unfunded/rate-limited OpenAI account.

---

## 8. Send the link

You're live. Share the Vercel URL with testers.

**Before a larger playtest, also read:**
- `RELEASE_CHECKLIST.md` — full pre-launch checklist (security headers, monitoring, legal)
- `SOAK_TEST_8_2A.md` — extended stability test plan for longer sessions

**Known limitations testers will hit** (see `README.md` → Known Limitations):
- No level-up button yet (XP progress bar shows, but leveling is not actionable in-session)
- Quests/Codex tabs are placeholders
- AI Director's memory window is the last 8 turns — long sessions will see it forget earlier events

---

*This doc assumes Vercel. For Netlify/Cloudflare Pages, replace step 5 with the corresponding section in `DEPLOYMENT.md` — steps 1–4 and 6–8 are identical regardless of frontend host.*
