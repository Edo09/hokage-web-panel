# Hokage Coaching — Admin Panel

Desktop admin panel for **Hokage Coaching** (fitness & nutrition coaching). React + Vite + TypeScript + Tailwind CSS + shadcn/ui-style components + recharts + React Router. UI in Spanish, prices in DOP. Dark mode is the default/signature look; light mode included.

Backed by the **same Supabase project as the mobile app** — real auth, real RLS, no mock data. See `docs/ADMIN_WEB_DB_CONNECTION.md` for the full data-layer/security model and `docs/COACH-ADMIN-PANEL-PRD.md` for the product spec this was built against.

## Run it

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Sign in with a Supabase account whose `profiles.role = 'coach'`. Any other account is refused and signed back out (`src/hooks/useAuth.tsx`).

`npm run build` type-checks and produces a production build in `dist/`.

## Before first use — apply these migrations

Run in the Supabase SQL editor, against the **mobile app's** `supabase/migrations/` (same project, that repo is the schema source of truth):

- `20260717150000_profiles_email_sync.sql` — denormalizes `auth.users.email` onto `profiles.email` (the panel's client list/search read it directly; `profiles` has no email column otherwise).
- `20260717150100_memberships_one_per_client.sql` — unique constraint on `memberships.client_id`, so the panel's membership edits update one row instead of piling up duplicates.
- Everything from the coaching-platform migration set (`20260707120000_coaching_platform.sql`, `20260708120000_exercise_catalog.sql`, …) — RLS, `is_coach()`, the exercise catalog.

## Deploy the account-creation function

Creating a client login needs the Supabase service-role key, which never touches this SPA — it's isolated in an Edge Function (`supabase/functions/create-client/index.ts`, in the mobile app repo):

```bash
supabase functions deploy create-client
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Until this is deployed, "Añadir cliente" will fail.

The function generates a **one-time temporary password** and returns it to the panel, which shows it once (copy button) for the coach to share with the client over WhatsApp. The client signs in with it and changes it in the app's **Ajustes → Cambiar contraseña**. No email delivery is involved anywhere in this flow.

## What's inside

- **Login** (`/login`) — branded, coach-only, real Supabase Auth.
- **Panel** (`/`) — KPI tiles, clients trend (recharts area, from real workout-log activity), workouts/week (bars), recent activity, expiring-soon list, quick actions.
- **Clientes** (`/clients`) — searchable table (by name/email), skeletons, empty state, add-client modal (calls the Edge Function).
- **Cliente** (`/clients/:id?tab=…`) — header + 5 tabs: Resumen, Rutinas (routine builder — exercises picked from the real shared catalog, assigns COACH routines), Nutrición (editable calorie goal + read-only meal display), Progreso (frequency chart + workout timeline), Membresía (status card + renew/pause/resume + edit form).
- **Membresías** (`/memberships`) — filter pills, urgency-sorted table (expired/expiring highlighted), renew / pause (confirm) / resume quick actions.
- **Ajustes** (`/settings`) — coach display name + WhatsApp (international digits) with a live mobile-app preview; updates the topbar.

## Data layer

The UI reads/writes data **only** through `src/services/clients.ts` and `src/services/exercises.ts` — real Supabase queries, RLS-authorized by the signed-in coach's JWT (`src/lib/supabaseClient.ts`). Types in `src/types.ts` mirror the real tables 1:1 (kept in sync with the mobile app's `src/types/database.ts`).

Auth: `src/hooks/useAuth.tsx` wraps `supabase.auth` + a `role === 'coach'` guard; `src/hooks/useCoach.tsx` reads/writes the coach's own profile row.

## Known gaps (not built here)

- **Multi-week Programs** (periodized training blocks — sets×rep-range, RIR, %1RM, deload weeks) exist in the mobile app and DB (`programs`, `program_days`, `program_exercises`, `program_weeks`) but have **no builder UI here yet**. This panel only assigns the simpler flat `routines`. See `docs/COACH-PROGRAMS-SPEC.md` and `docs/COACH-ADMIN-PANEL-PRD.md §6.4` for the intended Program Builder screen — the next major addition.
- Exercise **catalog management** (add/edit/delete movements + videos) has no dedicated screen — the routine builder only browses it.
- Meal-plan **authoring** (assign new meals/items to a client) isn't built; the Nutrición tab is read-only for meals, editable only for the calorie goal — matches the product's own "próxima iteración" note already in the UI copy.
- Body measurements (weight/composition trend) aren't surfaced in Progreso.

## Structure

```
src/
  types.ts                 # Domain types — mirror the real Supabase tables
  lib/supabaseClient.ts    # The one Supabase client instance
  services/                # Data layer — ONLY entry point for data
  hooks/                   # useTheme (dark/light + localStorage), useAuth, useCoach
  components/
    ui/                    # shadcn-style primitives (button, dialog, tabs, select…)
    layout/                # AppShell, Sidebar (collapsible), TopBar
    shared/                # StatTile, StatusBadge/OwnerBadge, Avatar, charts,
                           # EmptyState, TableSkeleton, AddClientDialog
  pages/                   # One file per route; client/ holds the 5 detail tabs
```

Design reference: the interactive prototype lives in the `design_handoff_hokage_admin/` package (same repo/project) — open `design/Hokage Admin.dc.html` in a browser.
