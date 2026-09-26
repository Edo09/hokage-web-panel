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

## Deploy the account functions

Creating a client login and resetting a forgotten password need the Supabase service-role key, which never touches this SPA — they're isolated in two Edge Functions in the mobile app repo (`supabase/functions/create-client` and `supabase/functions/reset-client-password`). From that repo:

```bash
supabase functions deploy create-client         --project-ref rzgwkwxskrovxnnymxqo
supabase functions deploy reset-client-password --project-ref rzgwkwxskrovxnnymxqo
# This panel's deployed origin(s), comma-separated, no trailing slash
# (add http://localhost:5173 only to use `npm run dev` against this project):
supabase secrets set ALLOWED_ORIGINS=https://<panel-domain> --project-ref rzgwkwxskrovxnnymxqo
```

The service-role key is provided to functions automatically. Until the functions are deployed and `ALLOWED_ORIGINS` includes this panel's origin, "Añadir cliente" and "Restablecer contraseña" fail.

Both functions return a **one-time temporary password** that the panel shows once (copy button) for the coach to share with the client over WhatsApp. The client signs in with it and changes it in the app's **Ajustes → Cambiar contraseña**. No email delivery is involved anywhere in this flow; a client who forgot their password asks the coach, who uses **Restablecer contraseña** on the client's page.

## What's inside

- **Login** (`/login`) — branded, coach-only, real Supabase Auth.
- **Panel** (`/`) — KPI tiles, clients trend, workouts/week, recent activity, expiring-soon list, quick actions.
- **Clientes** (`/clients`) — searchable table, add-client modal (`create-client`).
- **Cliente** (`/clients/:id?tab=…`) — header (with **Restablecer contraseña**) + tabs: Resumen, Programas (assign/build multi-week programs), Seguimiento (logged sets + completions), Nutrición (nutrition + supplement plans, calorie goal, logged meals with photos), Progreso, Membresía.
- **Programas** (`/programs`) — program template library: builder with live mobile preview, assign, PDF export, archive.
- **Nutrición** (`/nutrition`) — nutrition and supplement plan templates, same pattern as Programas.
- **Ejercicios** (`/exercises`) — exercise catalog CRUD (name, body part, demo video).
- **Membresías** (`/memberships`) — urgency-sorted table, renew / pause / resume.
- **Ajustes** (`/settings`) — coach display name + WhatsApp with a live mobile-app preview.
- **`/privacidad.html`** — static public privacy policy (`public/privacidad.html`) linked from the app's Ajustes and the store listings. Fill in its `[BRACKETED]` fields before publishing.

## Data layer

The UI reads/writes data **only** through `src/services/*` — real Supabase queries, RLS-authorized by the signed-in coach's JWT (`src/lib/supabaseClient.ts`). Types in `src/types.ts` mirror the real tables (kept in sync with the mobile app's `src/types/database.ts`).

Auth: `src/hooks/useAuth.tsx` wraps `supabase.auth` + a `role === 'coach'` guard; `src/hooks/useCoach.tsx` reads/writes the coach's own profile row.

## Known gaps

- Body measurements (weight/composition trend) aren't surfaced in Progreso yet.
- Payments, push notifications, announcements and client check-ins are out of scope for now (see `docs/COACH-ADMIN-PANEL-PRD.md`).

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
                           # EmptyState, TableSkeleton, AddClientDialog,
                           # ResetPasswordDialog, TempPasswordReveal
    program/, nutrition/   # Builders + mobile previews
  pages/                   # One file per route; client/ holds the detail tabs
```

Design reference: the interactive prototype lives in the `design_handoff_hokage_admin/` package (same repo/project) — open `design/Hokage Admin.dc.html` in a browser.
