# Chronicle AI — Setup Guide

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.x+ | https://nodejs.org |
| npm | 10.x+ | Bundled with Node |
| Supabase CLI | latest | `npm i -g supabase` |
| Git | any | https://git-scm.com |

---

## Local Development Setup

### 1. Clone and install
```bash
git clone <your-repo-url>
cd chronicle-ai
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:
- `VITE_SUPABASE_URL` — from Supabase dashboard > Settings > API
- `VITE_SUPABASE_ANON_KEY` — from Supabase dashboard > Settings > API

### 3. Set up Supabase

#### Option A: Supabase Cloud (recommended for getting started fast)
1. Create project at https://supabase.com
2. Copy URL and anon key into `.env.local`
3. Run migration:
```bash
supabase db push
```

#### Option B: Local Supabase
```bash
supabase start
# Note the URL and anon key from the output
supabase db push
```

### 4. Set OpenAI API key (Edge Functions)
```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

### 5. Start dev server
```bash
npm run dev
```

App runs at: http://localhost:5173

---

## Available Scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm test` | Run Vitest in watch mode (unit tests only) |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:integration` | Run integration tests against a real local Postgres (see below) |
| `npm run db:test:setup` | Set up a local Postgres DB with all migrations applied, for integration testing |
| `npm run db:types` | Generate TypeScript types from local Supabase schema (requires Docker) |
| `npm run db:types:remote` | Generate TypeScript types from your linked remote project |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format all src files |
| `npm run format:check` | Check formatting without writing |

---

## Supabase CLI Commands

```bash
# Start local Supabase stack
supabase start

# Stop local Supabase
supabase stop

# Push migrations to remote
supabase db push

# Generate TypeScript types from schema (requires Docker or Podman)
supabase gen types typescript --local > src/types/supabase-generated.ts

# Deploy edge functions
supabase functions deploy narrate

# View edge function logs
supabase functions logs narrate
```

---

## Generating Supabase Types

The Supabase client is typed against `src/types/supabase-generated.ts`. This file should be regenerated whenever the schema changes (new migration added).

### Standard path (requires Docker or Podman)

```bash
supabase start          # boots the full local stack, including PostgREST
npm run db:types        # writes src/types/supabase-generated.ts
```

This is the only fully-correct generation path — `supabase gen types --local` introspects your schema through a real `pg-meta` service and is exactly what `supabase gen types --linked` does against production.

### No container runtime available

`supabase gen types` requires a container runtime (Docker or Podman) to run the introspection service, even when targeting `--db-url` directly. If neither is available in your environment:

1. Apply migrations to a real local Postgres instance (no Supabase stack needed — see `npm run db:test:setup` below, which does this for you).
2. Manually verify `src/types/supabase-generated.ts` against the live schema using `information_schema` queries, or regenerate it once Docker/Podman becomes available.

The current `supabase-generated.ts` in this repo was produced this way — see the file's header comment for the exact process and the `psql` queries used to extract columns, CHECK-constraint enums, and foreign keys directly from a migrated database.

**Once Docker/Podman is available, always prefer regenerating with the real CLI command above** — it removes any risk of manual transcription drift.

---

## Integration Testing

Unit tests (`npm test`) mock the Supabase client entirely — they never touch a database. Integration tests (`npm run test:integration`) run the real service-layer functions (`createCharacter`, `getCampaign`, `appendTurn`, etc.) against **real PostgreSQL**, with real CHECK constraints, real foreign keys, and real Row Level Security enforcement.

### Why not the full Supabase stack?

`supabase-js` normally talks HTTP to a PostgREST server, which `supabase start` runs in Docker. In environments without a container runtime, integration tests use `tests/integration/support/pgAdapter.ts` — a small adapter implementing the exact nine query-builder methods our service layer calls (`select`, `insert`, `update`, `delete`, `eq`, `order`, `limit`, `single`, `maybeSingle`), backed by direct `pg` SQL execution instead of HTTP+PostgREST. The actual service functions run completely unmodified against this adapter — only the transport layer differs.

**If Docker/Podman is available**, prefer running `supabase start` and pointing tests at the real local stack instead — that exercises the genuine PostgREST layer too. The adapter exists specifically to unblock environments where that isn't possible.

### Setup

```bash
npm run db:test:setup
```

This script:
- Starts the local PostgreSQL service if not running
- Creates a fresh `chronicle_ai` database
- Applies a minimal `auth` schema stub (just enough of `auth.users` + `auth.uid()` to satisfy our migrations' FK references and RLS policies — see `supabase/local-test-support/0000_auth_stub.sql`)
- Applies migrations 0001, 0002, 0003 in order
- Creates an `authenticated_test` Postgres role with **no RLS bypass**, mirroring Supabase's `authenticated` role — this is what makes the RLS ownership tests meaningful rather than a no-op

### Running

```bash
npm run test:integration
```

Connects as `authenticated_test` (RLS enforced) for all service-layer calls, and as `postgres` (admin) only for test fixture setup (seeding `auth.users`, which application roles correctly cannot write to).

### What's covered

`tests/integration/supabase.integration.test.ts` exercises `createCharacter`, `getCharacter`, `updateCharacter`, and `deleteCharacter` end-to-end: real row persistence, real HP/AC recalculation through actual CHECK-constrained columns, real JSONB round-tripping for the `conditions` column, and real RLS — confirming one test user genuinely cannot read another user's character.

Integration tests are excluded from `npm test` (see the `exclude` pattern in `vite.config.ts`) and run only via the dedicated `vitest.integration.config.ts`, which uses a Node environment and skips the global Supabase mock in `tests/setup.ts`.

---

| Variable | Required | Where set | Description |
|----------|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | Yes | `.env.local` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | `.env.local` | Supabase public anon key |
| `OPENAI_API_KEY` | Phase 2+ | Supabase secrets | OpenAI API key (server-side only) |
| `VITE_APP_ENV` | No | `.env.local` | `development` / `staging` / `production` |
| `VITE_ENABLE_DEBUG_PANEL` | No | `.env.local` | Enable in-app debug panel |
| `VITE_ENABLE_MOCK_AI` | No | `.env.local` | Use mock AI responses (no API key needed) |

---

## Project Structure

```
chronicle-ai/
├── docs/                    # Documentation
│   ├── CHRONICLE_CONSTITUTION.md
│   ├── STYLE_GUIDE.md
│   ├── CHRONICLE_GAME_LOOP.md
│   ├── ROADMAP.md
│   └── SETUP.md
├── public/                  # Static assets
├── scripts/
│   └── setup-test-db.sh     # Local Postgres setup for integration tests
├── src/
│   ├── app/
│   │   ├── pages/           # Route-level page components
│   │   └── routes/          # React Router config
│   ├── components/
│   │   ├── ui/              # Primitive UI components (Button, Input…)
│   │   ├── adventure/       # Game-specific components (Phase 1+)
│   │   ├── auth/            # Auth forms (Phase 1 polish)
│   │   └── layout/          # AppShell, ProtectedRoute, PublicRoute
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── engine/          # Resolution engine (Phase 1)
│   │   ├── ai/              # AI narration layer (Phase 2)
│   │   └── supabase/        # Supabase client + services
│   ├── store/               # Zustand stores
│   ├── styles/              # Global CSS
│   └── types/
│       ├── supabase-generated.ts  # Generated DB types — do not edit by hand
│       └── ...              # Domain types (campaign, game, auth)
├── supabase/
│   ├── functions/           # Edge Functions
│   │   └── narrate/         # AI narration function
│   ├── local-test-support/  # Auth schema stub for bare-Postgres testing (not deployed)
│   └── migrations/          # SQL migrations
├── vitest.integration.config.ts  # Separate Vitest config for integration tests
└── tests/
    ├── setup.ts             # Vitest global setup (unit tests — mocks Supabase)
    ├── unit/                # Unit tests (mocked Supabase, fast, run in CI)
    └── integration/
        ├── support/
        │   └── pgAdapter.ts # Real-Postgres adapter for integration tests
        └── supabase.integration.test.ts
```

---

## Deploying

### Frontend (Vercel recommended)
```bash
npm run build
# Deploy dist/ to Vercel / Netlify / Cloudflare Pages
```

Vercel config:
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: add all `VITE_*` vars in dashboard

### Supabase Edge Functions
```bash
supabase functions deploy narrate --project-ref <your-project-ref>
```

---

## Troubleshooting

**"Missing Supabase environment variables"**
→ You haven't created `.env.local`. Run `cp .env.example .env.local` and fill it in.

**Auth redirect not working**
→ Add `http://localhost:5173` to your Supabase project's allowed redirect URLs.
→ Supabase Dashboard > Authentication > URL Configuration

**Edge function 401**
→ Ensure your request includes the Authorization header with the user's JWT.

**TypeScript errors in Supabase types**
→ Run `supabase gen types typescript --local > src/types/supabase-generated.ts` after schema changes (requires Docker/Podman). If unavailable, see "Generating Supabase Types" above for the bare-Postgres fallback.

**`npm run test:integration` fails to connect**
→ Run `npm run db:test:setup` first to create and migrate the local test database.
→ Confirm PostgreSQL is running: `pg_lsclusters` (Debian/Ubuntu) should show status `online`.

**`supabase gen types` hangs or errors with a Docker/Podman spawn failure**
→ The Supabase CLI's `gen types` command requires a container runtime even when using `--db-url`. Install Docker or Podman, or use the bare-Postgres fallback documented in "Generating Supabase Types" above.

**Integration test RLS assertions pass even when they shouldn't**
→ Check which role the test is connecting as. The `postgres` superuser role has `BYPASSRLS` and will never be blocked by policies — this is correct Postgres behavior, not a bug. RLS-dependent tests must connect as the `authenticated_test` role (created by `db:test:setup`), which has RLS enforced exactly like Supabase's `authenticated` role in production.

---

*Last updated: Phase 1.5*
