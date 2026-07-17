# Coach Programs — Multi-Week Periodized Training (PRD)

**Status:** Draft for review · **Author:** generated from `/samples` gap analysis · **Date:** 2026-07-17

This spec covers representing and delivering the kind of routine a coach hands a
client today (see `samples/RUTINA DE ENTRENAMIENTO.pdf` and
`samples/Rutina_Hipertrofia_Gluteos_Piernas_5_Semanas.pdf`) **exactly** inside
Habbito: a multi-week, periodized program with per-exercise prescriptions the
current data model cannot express.

Scope was locked with the following decisions:

- **Deliverable:** model + display faithfully (client renders read-only; not an authoring tool this round).
- **Authoring locus:** the separate Admin Web Panel — **which does not exist yet.** This spec defines the DB schema + client rendering + set logging; the panel is a downstream consumer of the same schema.
- **Periodization depth:** full multi-week program engine.
- **Per-exercise fields:** all of rep range, RIR/intensity, unilateral per-side, tempo + rest.
- **Exercise catalog:** expand the shared catalog to cover every movement (no free-text).
- **Client role:** view + **full set logging** (log actual weight/reps/RIR per prescribed set).
- **Current week:** auto from a start date, with a manual override to preview other weeks.
- **Placement:** a new Program section inside the existing Routines tab (the "Coach" segment).

---

## 1. Gap Analysis — Samples vs. Current App

Both PDFs are **5-week periodized blocks**. Each expresses three layers the app
currently flattens into one: a **program** (the block), **days** (a training
split), and **per-exercise prescriptions** that are **modulated week by week** by
a global periodization table.

### What the samples contain

| Sample element | Example from PDFs |
|---|---|
| Program with a focus + fixed duration | "Rutina de Hipertrofia — Enfoque Glúteos y Piernas (5 Semanas)" |
| Named training days with a muscle focus | "Día 1 – Pecho + Bíceps"; "Lunes – Glúteos + Femorales" |
| Sets × **rep range** | `4x6–8`, `4x12`, `3x15` |
| **%1RM / qualitative load** | `60% 1RM`, `ligero`, `moderado`, `pesado` |
| **Unilateral, per-side reps** | `3x12/12`, `3x10/10`, `3x15/15` |
| **Weekly periodization table** (RIR + %load + deload) | Wk1 60% RIR 2–3 · Wk2 65–70% RIR 1–2 · … · Wk5 50–60% RIR 3–4 deload |
| Deload week alters set count | "Series: 3 por ejercicio" in week 5 |
| **Tempo** | Eccentric 2–3 s, concentric "explosiva controlada", "pausa mínima" |
| **Progression rule** | Double progression: hold weight until 8 reps across all sets, then add load, reset to 6 |
| **Program-level notes / conditioning** | "Cardio 20 min postworkout"; "Notas de alto rendimiento" |

### What the app models today

- `routines`: `name`, `description`, `day_of_week` (single), `assigned_by`, `source`, timestamps. **Flat — no program, no weeks.**
- `routine_exercises`: `exercise_id`, `sets`, **single `reps: number`**, `weight_kg`, `rest_seconds`, `sort_order`, `notes`. **No rep range, no RIR, no %1RM, no per-side, no tempo, no per-week variation.**
- `exercises`: coach-managed catalog (220 seeded), name + video + body part. Read-only to clients; matched by name.
- `workout_logs`: one row per completed session, `completed_exercises: string[]` (**names only — no per-set weight/reps**). The progress dashboard therefore *estimates* volume from the plan (the deferred "P2" real set-logging).

### The delta (what's missing to implement the samples exactly)

1. **No program/week hierarchy.** A routine cannot span weeks or carry a periodization table. *(biggest gap)*
2. **Reps is a scalar, not a range.** Every sample line is a range (`6–8`, `12`).
3. **No intensity target.** No RIR, no %1RM, no qualitative load.
4. **No unilateral concept.** `12/12` per-side can't be represented.
5. **No tempo.** No eccentric/concentric/pause fields.
6. **No progression rule / program notes.** Double-progression, cardio, coaching notes have nowhere to live.
7. **Set logging is name-only.** Client can't record actual weight/reps/RIR against a prescription, so real volume/PRs are impossible.
8. **Catalog naming shorthand.** The catalog already covers ~90% of the movements, but the coach's shorthand ("Buenos días con barra", "Press banca plano", "Hip Thrust con barra") does not string-match the canonical seed names ("Good Morning con Barra", "Press de Banca Plano", "Hip Thrust con Barra"). A few movements are genuinely absent (**Pullover en polea**, **Step-up**, band-abduction variant). Needs a small catalog top-up **plus an alias/synonym layer** for import.

---

## 2. Problem Statement

Coaches on Habbito deliver real training as multi-week periodized programs —
sets × rep ranges, RIR and %1RM targets that change each week, unilateral work,
tempo, and a deload — but the app can only store a flat list of routines with a
single rep count and no week structure. Today a coach must flatten their program
into a PDF the client reads outside the app, so the client's logging, streaks,
volume, and AI insights are all disconnected from the actual prescription. Until
the model can represent a program faithfully, the coaching product is a
file-delivery service, not a training system.

---

## 3. Goals

1. **Faithfully represent** any of the sample programs in structured data with zero loss — a coach's 5-week block round-trips into the schema and back to the client screen without dropping rep ranges, RIR, %load, per-side, tempo, deload, or notes.
2. **Client sees the right week automatically.** On open, the active program shows the correct week's targets (auto from start date), with the ability to preview any week.
3. **Close the logging loop.** The client logs actual weight/reps/RIR per prescribed set, so the progress dashboard shows *real* volume and PRs instead of plan estimates.
4. **Reuse, don't fork, the coaching security model.** Programs inherit the existing single-coach RLS pattern (`is_coach()`, client-read-only-on-assigned) with no new auth concepts.
5. **Schema is Admin-Panel-ready.** The (not-yet-built) Admin Web Panel can CRUD programs against this schema without further migrations.

### Non-Goals

1. **In-app authoring for coaches.** No program builder UI in the client app this round — authoring is the Admin Web Panel's job (separate, future). *(scope containment)*
2. **AI parsing of the PDFs into programs.** Auto-ingesting a PDF is a separate initiative; here the data arrives structured. *(de-risks v1; the model must exist first regardless)*
3. **Per-exercise, per-week overrides.** The samples periodize *globally* (one weekly RIR/%load table), so v1 models week modulation at the program level; per-exercise week overrides are P2. *(matches the data; avoids over-building)*
4. **1RM testing / auto-load calculation.** We store %1RM as prescribed; we don't compute absolute loads from a tested 1RM. *(no 1RM capture today)*
5. **Program templates / cloning across clients.** Coach efficiency tooling lives in the panel, not here. *(out of client scope)*
6. **Nutrition periodization.** Meals stay as-is; this is training only.

---

## 4. User Stories

**Client (primary persona — the athlete)**

- As a client, I want to see my coach's program as a set of weeks and days so that I know exactly what to train and when.
- As a client, I want the app to open on the current week automatically so that I don't have to track which week of the block I'm on.
- As a client, I want to preview upcoming and past weeks so that I can see what's coming or review what I did.
- As a client, I want each exercise to show its sets, rep range, and this week's RIR/load target so that I train at the right intensity.
- As a client, I want per-side exercises shown as "12 per side" so that I don't under- or over-count unilateral work.
- As a client, I want to see tempo and rest so that I execute each rep as prescribed.
- As a client, I want to log the actual weight, reps, and RIR I hit on each set so that my progress reflects reality, not an estimate.
- As a client, I want my logged sets to feed the streak, volume, and AI weekly insight so that the whole app reflects my real training.
- As a client, I want coach programs to be clearly read-only so that I don't accidentally edit what my coach prescribed.

**Coach (secondary — consumes the schema via the future panel)**

- As a coach, I want to assign a multi-week program to a client so that they train my exact plan in the app.
- As a coach, I want to define a global weekly periodization table (RIR, %load, deload, set changes) so that intensity ramps correctly across the block.
- As a coach, I want to see a client's logged sets against my prescription so that I can adjust next block.

**Edge / empty / error states**

- As a client with no assigned program, I see an empty state explaining my coach hasn't assigned one yet (not a broken screen).
- As a client past the last week of a finished block, I see the program marked complete with a summary, not a broken "week 6".
- As a client offline, I can still view the cached program and queue set logs (consistent with the existing offline outbox).
- As a client whose coach used an exercise not yet in the catalog, I still see the prescribed name and targets (custom fallback render), just without a video/body-part.

---

## 5. Requirements

### Must-Have (P0)

**P0-1 · Program data model**
New tables under the existing coaching model:

- `programs` — `id`, `user_id` (client), `assigned_by` (coach), `source` (`'coach'`), `name`, `description`, `focus` (e.g. "Glúteos y Piernas"), `duration_weeks`, `start_date`, `status` (`active|completed|archived`), `progression_rule` (text), `tempo_default` (text), `notes` (text, e.g. "Cardio 20 min postworkout"), timestamps.
- `program_days` — `id`, `program_id`, `day_index` (1..N), `label` ("Pecho + Bíceps"), `weekday` (nullable `monday..sunday`), `sort_order`.
- `program_exercises` — the base prescription: `id`, `program_day_id`, `exercise_id` (catalog FK, nullable), `custom_name` (nullable fallback), `sets`, `rep_min`, `rep_max`, `is_unilateral` (bool → reps are per-side), `rir_min`/`rir_max` (nullable), `load_pct_1rm` (nullable int), `load_qualitative` (nullable enum `light|moderate|heavy`), `tempo` (nullable text), `rest_seconds` (nullable), `notes` (nullable), `sort_order`. **Constraint:** `exercise_id` or `custom_name` present.
- `program_weeks` — the global periodization table: `id`, `program_id`, `week_number` (1..N), `label` ("Base técnica"), `rir_min`/`rir_max`, `load_pct_min`/`load_pct_max` (nullable), `is_deload` (bool), `sets_override` (nullable int — deload = 3), `notes`.

*Acceptance:*
- [ ] Both sample PDFs insert into these tables with no field dropped (verified by a seed script that reproduces each PDF).
- [ ] A rep range renders as `6–8`; a per-side exercise renders as `12 / side`.
- [ ] The week-5 deload correctly reduces displayed set count via `sets_override`.

**P0-2 · Row-Level Security (reuse the coaching model)**
- [ ] `programs`, `program_days`, `program_exercises`, `program_weeks`: coach full access via `is_coach()`; client `select` only where `user_id = auth.uid()`; client `insert/update/delete` blocked (mirrors the assigned-routine restrictive policies).
- [ ] All new tables `enable row level security` and grant to `authenticated`.
- [ ] Migration is additive and idempotent (`if not exists`, `on conflict do nothing`) — the user applies SQL via the Supabase web editor, not `db push`.

**P0-3 · Current-week resolution**
- [ ] Given `start_date` and `duration_weeks`, the client computes current week = `clamp(floor((today − start_date)/7) + 1, 1, duration_weeks)`.
- [ ] Before `start_date` → week 1 preview with a "starts on {date}" note; after the last week → `status` shows complete.
- [ ] A manual week selector lets the client view any week 1..N without changing the auto value.
- [ ] **`start_date` cannot be in the past** (decided): a write-time trigger rejects `start_date < current_date` for API writers, so a block always begins on or after its assignment day. Direct DB / SQL-editor seeds (`auth.uid()` null) are exempt, matching the `guard_role_change` pattern.

**P0-4 · Client program rendering (Routines → Coach segment)**
- [ ] The Coach segment shows the active program with a week navigator (auto week highlighted).
- [ ] Each day is a card ("Día 1 · Pecho + Bíceps"); tapping opens its exercises.
- [ ] Each exercise shows: name (+ video/body-part if catalog-linked), `sets × rep_min–rep_max`, this week's RIR and load (from `program_weeks` merged with the base prescription), per-side badge, tempo, rest.
- [ ] Program header shows focus, week label, progression rule, and notes (cardio, etc.).
- [ ] Everything is visibly read-only (no edit/delete affordances).
- [ ] Empty state when the client has no program; complete state after the block.

**P0-5 · Per-set logging**
- New table `workout_set_logs` — `id`, `user_id`, `program_exercise_id` (FK), `week_number`, `date`, `set_index`, `weight_kg`, `reps`, `rir` (nullable), `created_at`.
- [ ] From an exercise, the client logs each set's actual weight/reps/RIR against the prescription; prescribed values pre-fill as placeholders.
- [ ] Logs write through the existing offline outbox (queue offline, sync on reconnect).
- [ ] Weight input respects the kg/lb preference (`weight-unit`) — stored in kg.
- [ ] RLS: client reads/writes only own rows; coach reads all (`is_coach()`).

**P0-6 · Catalog top-up + alias resolution**
- [ ] Seed the handful of missing movements (Pullover en polea, Step-up, band-abduction variant, any others surfaced when reproducing the PDFs).
- [ ] Provide an alias/synonym map (or normalized fuzzy match) so coach shorthand resolves to catalog canonical names during import/entry. Unresolved names fall back to `custom_name`.

### Nice-to-Have (P1)

- **P1-1 · Real volume + PRs in the dashboard.** Replace estimated volume with summed `workout_set_logs` (weight × reps); compute PRs and est. 1RM (Epley `e1rm` already exported in `utils/progress.ts`). Drop the "estimado según tu plan" caption.
- **P1-2 · Day completion + compliance.** Mark a day done for the week (derive from set logs); feed the existing streak/compliance dashboard from real program adherence.
- **P1-3 · AI insight upgrade.** Feed logged sets + week context into the weekly AI insight (`ai-insight.ts`) so it references actual progression vs. the prescribed RIR/%load ramp.
- **P1-4 · Set-by-set history per exercise.** Show last session's logged sets inline so the client applies double-progression ("hit 8×4 last week → add load").

### Future Considerations (P2)

- **P2-1 · Per-exercise per-week overrides.** A `program_exercise_week_overrides` table for coaches who periodize individual lifts differently (design the P0 schema so this slots in without breaking changes).
- **P2-2 · PDF/AI import.** Coach uploads a PDF; AI parses it into the P0 schema (reuse `services/llm.ts`).
- **P2-3 · 1RM capture + auto-load.** Store tested 1RMs and compute absolute target loads from `load_pct_1rm`.
- **P2-4 · Program templates & cloning** (Admin Panel).

---

## 6. Success Metrics

**Leading (days–weeks)**
- **Program view rate:** % of clients with an assigned program who open the Coach segment within 3 days of assignment. *Target: 80%.*
- **Set-logging activation:** % of program-days opened that get ≥1 set logged. *Target: 50% at 2 weeks.*
- **Correct-week accuracy:** 100% of opens show the calendar-correct week (instrumented/QA, not a range).

**Lagging (weeks–months)**
- **Logged vs. estimated volume:** share of dashboard volume derived from real set logs rather than plan estimates. *Target: >70% for clients on a program.*
- **Block completion:** % of assigned programs where the client logs into the final (deload) week. *Target: 40%.*
- **Coaching retention:** membership retention for clients on a structured program vs. flat routines (directional; compare cohorts after one full block).

*Measurement:* instrument the four client events (program_opened, week_viewed, set_logged, day_completed); read from the analytics connector once wired, else from `workout_set_logs` timestamps.

---

## 7. Open Questions

- **[data]** Do we backfill any existing coach-assigned flat routines into programs, or start fresh? (Leaning fresh — flat routines lack week/RIR data to backfill.)
- **[product]** Deload week reduces sets globally via `sets_override`; do any coaches also drop *exercises* in deload? If so we need a per-week day/exercise inclusion flag (P2).
- **[product]** Qualitative load (`light/moderate/heavy`) and `load_pct_1rm` can both be present or absent per line — confirm display precedence (show %1RM when present, else qualitative).
- **[eng]** How does the client mark a day "done" — explicit button, or auto when all sets logged? (Affects P1-2 and compliance.)
- ~~**[eng]** Can the coach set a past start?~~ **Resolved:** no — `start_date` cannot be in the past (write-time trigger). Week 1 always begins on or after assignment.
- **[design]** Set-logging UI density: inline rows under each exercise vs. a focused "log this exercise" sheet.
- **[ops]** Since the Admin Panel doesn't exist yet, how is the first real program created for testing — a hand-written SQL seed reproducing a sample PDF? (Recommended as the P0 acceptance fixture.)

---

## 8. Timeline & Phasing

No external hard deadline. Suggested phasing so each phase is shippable and verifiable against the sample PDFs:

- **Phase 1 — Schema + fixtures (P0-1, P0-2, P0-6).** Migrations for the four program tables + set-logs, RLS, catalog top-up, and a seed script that reproduces both sample PDFs. *Exit:* the PDFs round-trip in the DB.
- **Phase 2 — Read-only client rendering (P0-3, P0-4).** Program hooks + the Coach-segment UI with week navigation. *Exit:* a client sees either sample program, correct week, fully faithful, read-only.
- **Phase 3 — Set logging (P0-5).** Logging UI + offline outbox + unit handling. *Exit:* client logs sets; rows land in `workout_set_logs`.
- **Phase 4 — Close the loop (P1-1…P1-4).** Real volume/PRs, compliance, AI insight upgrade.

**Dependencies**
- Admin Web Panel is downstream, not blocking — Phase 1's seed script substitutes for it during P0/P1.
- Set logging (Phase 3) subsumes the previously deferred progress "P2 set-logging"; coordinate with `docs/PROGRESS-REDESIGN.md` so the dashboard's estimated-volume caption is retired in Phase 4, not earlier.

---

## Appendix A — Sample → Schema mapping (worked example)

`Rutina_Hipertrofia` · **Lunes – Glúteos + Femorales**, exercise line
`Hip Thrust con barra - 4x12 (60% 1RM)`:

```
programs:        { name: "Hipertrofia — Glúteos y Piernas", focus: "Glúteos y Piernas",
                   duration_weeks: 5, start_date: <assigned>, status: "active",
                   notes: null, progression_rule: null }
program_days:    { day_index: 1, label: "Glúteos + Femorales", weekday: "monday" }
program_exercises:{ exercise_id: <Hip Thrust con Barra>, sets: 4, rep_min: 12, rep_max: 12,
                    is_unilateral: false, load_pct_1rm: 60, load_qualitative: null }
program_weeks:   [ {week:1,label:"Técnica y base",rir_min:2,rir_max:3,load_pct_min:60,load_pct_max:60,is_deload:false},
                   {week:2,rir_min:1,rir_max:2,load_pct_min:65,load_pct_max:70},
                   {week:3,rir_min:1,rir_max:1,load_pct_min:75,load_pct_max:75},
                   {week:4,rir_min:0,rir_max:1,load_pct_min:80,load_pct_max:85},
                   {week:5,label:"Descarga",rir_min:3,rir_max:4,load_pct_min:50,load_pct_max:60,is_deload:true,sets_override:3} ]
```

Unilateral example (`Zancadas caminando - 3x12/12`): `sets:3, rep_min:12, rep_max:12,
is_unilateral:true` → renders "3 × 12 / side".

The first PDF's `Día 1 – Pecho + Bíceps · Press plano barra — 4x6–8` maps identically,
with `rep_min:6, rep_max:8` and its own `program_weeks` table (RIR 2–3 → 0–1, week 5
deload to 3 sets, −10–15% load).
