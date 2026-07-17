# Hokage Coaching — Admin Panel

Desktop admin panel for **Hokage Coaching** (fitness & nutrition coaching). React + Vite + TypeScript + Tailwind CSS + shadcn/ui-style components + recharts + React Router. UI in Spanish, prices in DOP. Dark mode is the default/signature look; light mode included.

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL. Any email/password signs you in (auth is a placeholder for Supabase Auth).

`npm run build` type-checks and produces a production build in `dist/`.

## What's inside

- **Login** (`/login`) — branded, coach-only.
- **Panel** (`/`) — KPI tiles, clients trend (recharts area), workouts/week (bars), recent activity, expiring-soon list, quick actions.
- **Clientes** (`/clients`) — searchable table, skeletons, empty state, add-client modal with success state.
- **Cliente** (`/clients/:id?tab=…`) — header + 5 tabs: Resumen, Rutinas (routine builder assigns COACH routines), Nutrición (editable calorie goal + meal cards with macros), Progreso (frequency chart + workout timeline), Membresía (status card + renew/pause + edit form).
- **Membresías** (`/memberships`) — filter pills, urgency-sorted table (expired/expiring highlighted), renew / pause (confirm) / resume quick actions.
- **Ajustes** (`/settings`) — coach display name + WhatsApp (international digits) with a live mobile-app preview; updates the topbar.

## Swap in Supabase later

The UI reads/writes data **only** through `src/services/clients.ts` (typed async functions with artificial latency so skeletons show). Replace the bodies of those functions with Supabase queries and delete `src/services/mockData.ts` — no UI changes needed. Types in `src/types.ts` mirror the intended tables (`profiles`, `routines` + `exercises`, `meals` + `items`, `workout_logs`, `memberships`).

Auth: `src/hooks/useAuth.tsx` is a sessionStorage flag — swap for `supabase.auth` and keep `RequireAuth`.

## Structure

```
src/
  types.ts                 # Domain types (future Supabase tables)
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
