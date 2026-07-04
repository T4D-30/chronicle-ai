# Chronicle AI — Release Checklist

This checklist must pass before any public deployment.
Run through it top-to-bottom. Check off items as you verify them.
Never mark an item complete without actually verifying it.

---

## 1. Code Quality

- [x] `npx tsc --noEmit` — zero TypeScript errors (enforced in CI)
- [x] `npm test` — all unit tests pass, currently 1323 (enforced in CI)
- [ ] `npm run test:integration` — all integration tests pass (currently 70; requires Supabase prod)
- [x] `npm run build` — production build completes without errors (enforced in CI)
- [x] CI pipeline verifies no OpenAI API key leaked into bundle
- [ ] No `console.log` / `console.warn` left in production paths (use `console.error` only for genuine errors)
- [x] Debug Panel (`DebugPanel.tsx`) gated behind `VITE_ENABLE_DEBUG_PANEL` — tab absent when flag is not `true` (enforced in `AdventureHub.tsx`)

---

## 2. Environment Variables

All variables must be set in the Supabase project and in your hosting provider.

### Client-side (Vite — prefix `VITE_`)

| Variable | Required | Production value |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (safe to expose) |
| `VITE_APP_NAME` | ✅ | `Chronicle AI` |
| `VITE_APP_VERSION` | ✅ | Current semver tag |
| `VITE_APP_ENV` | ✅ | `production` |
| `VITE_ENABLE_DEBUG_PANEL` | ✅ | `false` |
| `VITE_ENABLE_DEV_TOOLS` | ✅ | `false` |
| `VITE_ENABLE_MOCK_AI` | ✅ | `false` |

### Server-side (Supabase Edge Function secrets — never in client bundle)

| Variable | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | Set via Supabase Dashboard > Edge Functions > Secrets |
| `AI_MAX_TOKENS` | ✅ | `4096` (or lower for cost control) |
| `AI_MAX_REQUESTS_PER_USER_PER_MINUTE` | ✅ | `10` recommended for alpha |

- [ ] All client-side variables set in hosting provider (Vercel / Netlify / Cloudflare Pages)
- [ ] `OPENAI_API_KEY` set as Supabase Edge Function secret (NOT in hosting provider)
- [ ] No OpenAI key present anywhere in the client bundle — verify with `grep -rE "sk-proj-|sk-[A-Za-z0-9]{20,}" dist/`

---

## 3. Supabase Project Configuration

### Authentication

- [ ] Email auth enabled in Supabase Dashboard > Authentication > Providers
- [ ] Site URL set to production domain (e.g. `https://chronicle-ai.app`)
- [ ] Redirect URLs allowlist includes production domain + `/auth/callback`
- [ ] Email confirmation enabled (recommended) or disabled intentionally
- [ ] Password minimum length set (8+ recommended)
- [ ] Rate limiting on auth endpoints reviewed (Supabase default: 4 emails/hour)

### Database

- [ ] All migrations applied: `0001` through `0005`
  - Verify: `SELECT name FROM supabase_migrations.schema_migrations ORDER BY name;`
- [ ] RLS enabled on all tables:
  - `profiles` — RLS ✅ (from 0001)
  - `campaigns` — RLS ✅ (from 0001)
  - `game_sessions` — RLS ✅ (from 0001)
  - `narrative_turns` — RLS ✅ (from 0001)
  - `characters` — RLS ✅ (from 0002)
- [ ] All RLS policies restrict to `auth.uid()` ownership
- [ ] No public-readable tables without explicit intent
- [ ] Connection pooling mode: `Transaction` (recommended for serverless)

### Edge Functions

- [ ] `narrate` function deployed: `supabase functions deploy narrate`
- [ ] Function is set to `--no-verify-jwt false` (JWT required — it validates internally)
- [ ] CORS origins restricted to production domain in function code
- [ ] Function tested end-to-end in production environment with a real API key

### Backups

- [ ] Supabase point-in-time recovery enabled (Pro plan required)
- [ ] Manual database backup taken before first deployment: `pg_dump` or Supabase Dashboard > Database > Backups
- [ ] Backup restoration procedure documented and tested

---

## 4. Security

- [ ] `Content-Security-Policy` header configured at hosting provider level
- [ ] `X-Frame-Options: DENY` set
- [ ] `X-Content-Type-Options: nosniff` set
- [ ] HTTPS enforced (automatic on Vercel/Netlify/Cloudflare)
- [ ] Supabase anon key rotation policy documented (rotate if ever accidentally committed)
- [ ] No sensitive data stored in localStorage or sessionStorage (Chronicle AI uses Supabase auth only)
- [ ] Error messages shown to users do not expose stack traces or DB errors

---

## 5. Performance

- [ ] Lighthouse score ≥ 90 on Performance (run against production URL)
- [ ] Lighthouse score ≥ 90 on Accessibility
- [ ] Bundle size audit: `npm run build` — check chunk sizes in output
  - `vendor-react` chunk < 220 kB gzip
  - `vendor-supabase` chunk < 220 kB gzip
  - `engine` chunk < 25 kB gzip
  - Individual page chunks < 50 kB gzip each
- [ ] No blocking render resources (fonts loaded via `<link rel="preconnect">`)
- [ ] Images optimized (if any portrait uploads: WebP, max 512×512)

---

## 6. Accessibility

- [ ] Skip link visible on keyboard focus (`.skip-link` in `AppShell`)
- [ ] All interactive elements reachable by Tab
- [ ] Focus ring visible on all focusable elements (`ring-arcane-400`)
- [ ] Contrast ratio ≥ 4.5:1 for all body text (verified against void-950 background)
- [ ] Screen reader test: VoiceOver (macOS/iOS) or NVDA (Windows) can navigate the main flows
- [ ] `prefers-reduced-motion` tested: animations disabled, LoadingSpinner shows static dot
- [ ] AdventureHub tab nav announces correctly to screen reader
- [ ] Combat Panel action buttons have descriptive labels

---

## 7. Monitoring & Logging

- [ ] Error tracking service configured (Sentry recommended — `@sentry/react` + `@sentry/browser`)
  - DSN set as environment variable
  - Source maps uploaded to Sentry (or disabled for security)
  - User PII not sent to Sentry (no email/userId in error context)
- [ ] Supabase Dashboard > Logs reviewed before launch
- [ ] Edge Function logs checked: Dashboard > Edge Functions > Logs
- [ ] Uptime monitoring configured (e.g. Betterstack, UptimeRobot)
- [ ] Alert on Edge Function error rate > 5%

---

## 8. Legal & Privacy

- [ ] Privacy policy published and linked from landing page footer
- [ ] Terms of service published and linked from landing page footer
- [ ] Cookie notice if any cookies beyond auth session are set
- [ ] GDPR account deletion flow: user can delete account and all associated data
  - Chronicle AI stores: `profiles`, `characters`, `campaigns`, `game_sessions`, `narrative_turns`
  - All linked by `user_id` / `auth.uid()` with CASCADE deletes (verify in migrations)
- [ ] Age gate or minimum-age notice (if applicable for jurisdiction)

---

## 9. Pre-Launch Smoke Test

Run through this scenario manually on the production environment:

1. [ ] Land on `/` — page loads, animations play, value props visible
2. [ ] Click "Begin Your Chronicle" — redirects to `/signup`
3. [ ] Sign up with a test email — email confirmation received (if enabled)
4. [ ] Log in — redirects to `/dashboard`
5. [ ] Create a character through the full wizard — saved to DB
6. [ ] Create a campaign — assign the character, saved to DB
7. [ ] Open campaign detail — Begin Adventure button visible
8. [ ] Start adventure — `AdventureHub` loads, character stats visible in sidebar
9. [ ] Type an action in the Story Panel — AI narration streams back
10. [ ] Check Journal tab — turn history visible
11. [ ] Open Atlas tab — shows empty state (no locations yet) or locations if Director provided them
12. [ ] Trigger combat (via action that Director escalates) — `CombatPanel` opens
13. [ ] Complete combat — XP/loot awarded, session summary updated
14. [ ] Pause session — session state preserved
15. [ ] Refresh page — session resumes from where it was left
16. [ ] End session — return to campaign detail
17. [ ] Log out — redirected to landing page

---

## 10. Rollback Plan

- [ ] Previous deployment tagged in Git (`git tag v0.1.0-pre-deploy`)
- [ ] Hosting provider rollback procedure documented (Vercel: instant rollback to previous deployment)
- [ ] Database rollback script prepared for any migration issues (if new migrations are run at deploy time, have `DOWN` scripts ready)
- [ ] On-call contact defined for launch day

---

*Last updated: Phase 8.3 — Interactive DM Interface*
