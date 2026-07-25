# Recipe Ledger

A personal recipe book + grocery cost calculator (AU, bakery-focused). Single
user per account (email+password sign-in), multi-device sync via Postgres.
Scan a recipe photo or enter one manually, price it against Coles (scraped)
and Woolworths (manual entry), and keep one running shopping list.

## Stack

Next.js App Router, TypeScript, Tailwind v4, Prisma + Postgres, Auth.js
(Credentials provider, email+password; Google OAuth can be added as an
extra sign-in option), Gemini (`@google/genai`) for recipe-photo parsing and
Coles HTML parsing.

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start Postgres** (docker-compose maps it to host port `55432`, not
   `5432`, to avoid clashing with any Postgres already running on your
   machine):

   ```bash
   docker compose up -d
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   `.env` already has a working `DATABASE_URL` for the docker-compose
   Postgres above. Fill in the rest as you need them (see "What needs real
   credentials" below).

4. **Run migrations**

   ```bash
   npx prisma migrate dev
   ```

   This also enables the Postgres `pg_trgm` extension (used for catalog
   autocomplete search).

5. **Run the app**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and create an account at `/signup` (email +
   password, 8+ characters). If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are
   also set, a "Sign in with Google" button appears on `/signin` as an
   additional option — it's entirely optional.

6. **Run tests**

   ```bash
   npm test
   ```

   Covers `lib/units/*` and `lib/pricing/*` (unit conversion + cost/pack/
   staleness/savings math) — the parts of the app that don't depend on
   external services.

## Environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | everything | Postgres connection string |
| `AUTH_SECRET` | Auth.js session signing (used by email+password sessions too) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Auth.js | `http://localhost:3000` locally |
| `GEMINI_API_KEY` | `/scan` recipe parsing, Coles search parsing | Get one at https://aistudio.google.com/apikey |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional Google sign-in, in addition to email+password | https://console.cloud.google.com/apis/credentials, redirect URI `http://localhost:3000/api/auth/callback/google` |

## What's stubbed / can't be live-tested here

No live credentials were available while building this, so the following
code paths are implemented but **unverified against the real services**:

- **Gemini calls** (`src/lib/gemini/client.ts` and its two callers,
  `src/lib/scrape/coles.ts` for HTML→product parsing and
  `src/app/api/scan/parse/route.ts` for photo→ingredients parsing). The
  model-fallback logic (`gemini-3.6-flash` → `gemini-3.5-flash` →
  `gemini-3.1-flash-lite` on 429/5xx/timeout/schema-validation-failure),
  JSON-schema validation via Zod, and usage logging to `GeminiUsageLog` are
  all wired up, but the actual prompt→response shape has not been exercised
  against a real API key.
- **Coles scraping** (`src/lib/scrape/coles.ts`): fetches
  `https://www.coles.com.au/search/products?q=...` with a realistic
  User-Agent and one retry, trims the HTML, and hands it to Gemini to parse.
  Coles' actual markup/robots behaviour has not been checked live — if their
  page shape has drifted, the Gemini prompt in
  `src/lib/gemini/prompts/coles-html-parse.ts` may need tweaking.
- **Google OAuth**: the Auth.js Google provider + Prisma adapter are wired
  correctly per the standard pattern as an optional additional sign-in
  method, but the full sign-in redirect flow needs a real Google Cloud OAuth
  client to test end-to-end. Email+password (the default, always-on auth
  method) is fully implemented and tested against the local database.

Everything else — schema, units/pricing math (unit-tested), server actions,
API routes, and all 8 screens — is real, working code against the local
Postgres database, not mock data.

## Deviations from the original spec

- **Prisma major version**: pinned to Prisma 6 rather than the newly-released
  Prisma 7. Prisma 7 removes `datasource.url` from `schema.prisma` in favor
  of driver adapters wired up in `prisma.config.ts` + the `PrismaClient`
  constructor — a bigger structural change than this task called for. Prisma
  6 keeps the familiar `DATABASE_URL` + `npx prisma migrate dev` workflow the
  spec describes.
- **docker-compose Postgres port**: mapped to host port `55432` instead of
  `5432`, because this dev machine already had a local Postgres bound to
  `5432` and Docker's `*:5432` proxy silently loses to a more specific
  `127.0.0.1:5432` listener on macOS. `.env` / `.env.example` already point
  at `55432`.
- **`GeminiUsageLog.userId`**: kept as required (matches the spec's model
  list), so usage logging only happens for authenticated requests — all
  current call sites are authenticated, so this doesn't limit anything.
- Category picker isn't surfaced in the Scan Review / Manual Entry UI yet —
  new catalog ingredients created from those flows default to `OTHER`. The
  data model and `setCatalogConversion`/`upsertProductOption` actions support
  changing category/conversions; a dedicated catalog-editing screen wasn't
  in the 8-screen list, so it's not built.

## Project layout

```
prisma/schema.prisma       Full data model (Auth.js + app tables)
docker-compose.yml         Local Postgres for dev
src/app/(auth)/signin      Email+password sign-in (+ optional Google button)
src/app/(auth)/signup      Email+password account creation
src/app/(app)/...          Recipes, Scan, List, Settings screens
src/app/api/...            Coles search, swap, scan parse, catalog suggest, auth
src/components/...         UI split by feature (recipe, scan, list, ui)
src/lib/units/             Dimensional conversion table + normalize + format
src/lib/pricing/           Cost, pack count, staleness, savings math
src/lib/gemini/            Client, Zod schemas, prompts (server-only)
src/lib/scrape/            Coles fetch + 24h DB cache + HTML trimming (server-only)
src/lib/actions/           Server actions: recipes, catalog, list, settings
```
