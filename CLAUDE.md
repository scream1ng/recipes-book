# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Recipe Ledger — a personal recipe book + grocery cost calculator (AU, single user per account). Capture a recipe by photo or pasted text, price its ingredients against Coles (scraped) and Woolworths (manual entry), and keep one running shopping list across all recipes.

Stack: Next.js App Router + TypeScript, Tailwind v4, Prisma + Postgres, Auth.js (Credentials provider; Google OAuth optional), Gemini (`@google/genai`) for recipe parsing and Coles HTML parsing.

## Commands

```bash
npm install
docker compose up -d          # Postgres on host port 55432 (not 5432 — see below)
cp .env.example .env          # fill in GEMINI_API_KEY, AUTH_SECRET at minimum
npx prisma migrate dev        # also enables pg_trgm (catalog autocomplete)
npm run dev
npm run lint                  # eslint
npm test                      # vitest run — no include restriction in vitest.config.ts; in practice src/lib/units, src/lib/pricing, src/lib/scrape
npx vitest run path/to/file.test.ts   # single test file
npx vitest run -t "test name"          # single test by name
npm run build
npm start                     # prisma migrate deploy && next start (production)
```

Docker-compose maps Postgres to `55432` instead of `5432` — a local Postgres bound to `5432` on macOS silently wins over Docker's proxy, so `.env`/`.env.example` both point at `55432`.

After changing `prisma/schema.prisma`, run `npx prisma migrate dev` — this regenerates the client into `src/generated/prisma` (not the default `node_modules` location).

## Architecture

### Route groups and auth gate

`src/app/(app)/*` is the authenticated app (Recipes, Scan, Order, Ingredients/Pantry, Settings); `src/app/(auth)/*` is signin/signup. Every server action and route handler that touches user data calls `requireUser()` (`src/lib/auth.ts`) — it reads the session, redirects to `/signin` if absent, and lazily creates a `UserSettings` row on first call. Auth uses NextAuth v5 beta with JWT sessions (not DB sessions) even though `PrismaAdapter` is wired up — the adapter exists to link Google OAuth accounts, not to back the primary session strategy.

### Data model shape

Two ingredient concepts, easy to conflate:
- **`CatalogIngredient`** — the user's master ingredient list (one row per distinct ingredient they've ever used), holding pricing (`ProductOption` → `PriceSnapshot`) and pantry state (`onHand`). Lives at `/pantry` ("Ingredients" in the UI).
- **`RecipeIngredient`** — one line inside one recipe, optionally linked to a `CatalogIngredient` via `catalogIngredientId`. Carries the recipe-specific raw text/amount/unit alongside the resolved canonical quantity.

Two "how many" concepts, also easy to conflate — see `ServesStepper` vs the Order screen:
- **`baseServes`/`targetServes`** — how big one batch of the recipe is (scales ingredient quantities and cost for *reading* the recipe).
- **`orderQty`** — how many separate times you're making that recipe this shopping trip (multiplies the whole scaled recipe into `ShoppingListItem`/`ShoppingListContribution`).

Shopping list math (`src/lib/actions/list.ts`) aggregates `qtyCanonical * orderQty` across all recipes with `orderQty > 0`, grouped by `CatalogIngredient`, into one list a user checks off.

### Canonical units

`src/lib/units/dimensional.ts` converts within a physical dimension to a base unit (grams for mass, ml for volume; Australian conventions — 1 cup = 250ml, 1 tbsp = 20ml, 1 tsp = 5ml). `normalize.ts` builds on that for cross-dimension conversion (e.g. "1 cup flour" → grams), which requires a per-ingredient density (`gramsPerMl`/`gramsPerCount`/`gramsPerBunch` on `CatalogIngredient`) — without it, `qtyCanonical` is null and the line is flagged `needsReview`. This was originally the only unit-tested part of the app with no external dependency (`src/lib/units/__tests__`, `src/lib/pricing/__tests__`); `src/lib/scrape/__tests__` now also covers the `__NEXT_DATA__` parser (pure) and the Coles fetch/cache layer (fetch + Prisma mocked) against captured fixture HTML. Any file importing `"server-only"` needs the `server-only` → stub alias in `vitest.config.ts` to be test-importable (Next resolves the real one via its own bundled copy at build time; plain Node/vitest can't see it).

### Pricing

`src/lib/pricing/` — `cost.ts` (cost per serve / whole recipe / already-have vs need-to-buy split), `packs.ts` (pack-count rounding), `staleness.ts` (flagging stale prices per `UserSettings.stalePriceHours`), `storeSelect.ts` (Coles vs Woolworths vs cheapest-of-both per `StorePreference`), `savings.ts` (cheaper-alternative suggestions surfaced on the recipe detail page).

### Recipe capture flow (photo + paste share one pipeline)

Both `/scan` (photo) and `/scan/paste` (pasted text) call Gemini to produce the same `ParsedResult` JSON shape (`recipeName`, `minutes`, `serves`, `lines[]`, `method[]`), stash it in `sessionStorage` under `"scan-review-draft"` (with a `source: "photo" | "paste"` tag), and redirect to `/scan/review`. `ReviewEditor` is the single confirm/edit screen for both paths — origin-aware copy and back-navigation branch on `draft.source`. Saving calls `saveScannedRecipe` (`src/lib/actions/recipes.ts`), which resolves each line to a `CatalogIngredient` via `findOrCreateCatalogIngredient` (`src/lib/actions/catalog.ts`) before creating the `Recipe`.

The two entry points use different prompts (`src/lib/gemini/prompts/recipe-parse.ts` for photos, `recipe-parse-text.ts` for pasted text) because their failure modes differ: photo parsing fights OCR illegibility, text parsing fights web-paste cruft (nav, ads, comments, related-recipe blocks, nutrition tables) that has to be actively filtered out. Both prompts do catalog-matching in the same call (the user's existing `CatalogIngredient` names are passed into the prompt so a parsed line can be matched to an existing catalog entry with a confidence score).

There is no manual/blank-recipe entry point — pasting text *is* the manual-entry surface. `ReviewEditor` supports adding a blank ingredient/method-step row for anything the parser missed.

### Gemini integration

`src/lib/gemini/client.ts`'s `generateJson()` is the only way any code calls Gemini. It tries a 3-tier model fallback chain (`MODEL_CHAIN`, currently `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite`) on failure/429/5xx/timeout/schema-validation-failure, validates the response against a Zod schema (`src/lib/gemini/schemas.ts`), and logs every attempt (model, kind, success) to `GeminiUsageLog`. `images` is optional on the call — text-only prompts (recipe-paste, and any future text-only use) need no extra plumbing. There are two `GeminiUsageKind`s: `RECIPE_PARSE` (both scan flows) and `COLES_HTML_PARSE`.

### Coles integration

`src/lib/scrape/coles.ts` fetches the Coles search results page with a full browser header set (Coles' Imperva/Incapsula bot defense blocks requests missing `Accept-Language`/`sec-ch-ua*`/`Sec-Fetch-*`, even with a correct User-Agent) and parses the `__NEXT_DATA__` JSON the page embeds directly (`coles-next-data.ts`, pure/no LLM) — deterministic, no Gemini call on this path. A detected block page (`"Pardon Our Interruption"`) throws rather than being treated as zero results. Fetches are serialized and paced through a module-level queue (spacing + jitter + a cooldown after a detected block) — this app is single-user/single-instance, so that's sufficient; burst requests trip the block even with correct headers. `coles-cache.ts` wraps this in a 24h DB cache (`ColesSearchCache`, keyed by normalized query string) shared by `/api/coles/search` (autocomplete + swap sheet) — on failure it serves an expired cache row if one exists (stale price beats no price), never overwrites a good row with a failure, and only returns an empty array if there's truly nothing cached. `pickRecommendedColesProduct` (`src/lib/pricing/recommend.ts`) auto-picks a confident match when candidates agree, or a low-confidence ballpark (median unit price, not cheapest, to avoid systematically understating cost) when they don't — flagged via `ProductOption.lowConfidence` and shown as "check price" everywhere that price appears (pantry, order, list, swap sheet). The Gemini HTML-parse path (`coles-html-parse.ts` prompt, `html-trim.ts`) is no longer on the hot path — `trimHtmlForParsing` strips `<script>` tags, so it structurally can't see `__NEXT_DATA__` and isn't a fallback for it.

### Mutations: server actions vs API routes

Client-triggered mutations mostly go through `"use server"` actions in `src/lib/actions/*.ts`, called directly from components. API routes under `src/app/api/*` exist specifically where HTTP semantics are needed: multipart file upload (`/api/scan/parse` for photos), a plain JSON POST that isn't tied to a form (`/api/scan/parse-text`), Coles search/swap, and the NextAuth handler.

### UI conventions

Visual language is iOS HIG throughout. Screens are built from shared primitives in `src/components/ui/` — `ListGroup`/`ListRow`/`ListDivider` for grouped lists, `NavBar`/`BackLink` for navigation, `StickyActionBar` for the bottom primary action, `SectionHeader`, `Icon`, `Toggle`, `ConfirmDialog`, `Spinner`. Build new screens from these rather than hand-rolling list/nav patterns. Tap targets follow the 44pt iOS minimum (see `Toggle`, `TabBar`, method-step remove buttons).

### Rate limiting

`src/lib/ratelimit.ts` is an in-memory per-instance token bucket — explicitly single-instance-only; would need a Redis/DB-backed bucket before a multi-instance deploy.

## Known gaps (from the original build, still true)

- Gemini calls and Coles scraping are implemented against real endpoints but were built without live credentials available at the time — prompt/response shape may need adjustment against real traffic (see model-fallback + schema validation described above, which exists precisely to make that safe).
- `GeminiUsageLog.userId` is required, so usage logging only happens for authenticated requests (true for every current call site).
