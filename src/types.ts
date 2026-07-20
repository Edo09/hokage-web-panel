/**
 * Hokage Coaching — Admin Panel domain types.
 * Mirrors the REAL Supabase schema 1:1 (see docs/ADMIN_WEB_DB_CONNECTION.md
 * and the mobile app's src/types/database.ts, the source of truth). The
 * mock-era shape (sex: 'M'|'F', 5-level activity, fixed DOP currency, free-
 * text exercises) has been replaced — those never matched the DB.
 */

export type UserRole = 'user' | 'coach';
export type MembershipStatus = 'active' | 'expired' | 'paused' | 'cancelled';
export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'active' | 'very_active';
export type ProfessionType = 'desk' | 'physical';
export type ProfileGoal = 'lose_weight' | 'gain_muscle' | 'maintain';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
/** null = client made it themselves; 'ai' = in-app generator; 'coach' = assigned here. */
export type RoutineSource = 'user' | 'ai' | 'coach';

/** `profiles` row. `email` is denormalized from `auth.users` by a sync
 *  trigger (supabase/migrations/20260717150000_profiles_email_sync.sql in
 *  the mobile app repo — apply it before using this panel) and is always
 *  populated for every account created through the create-client function. */
export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  age: number | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  profession_type: ProfessionType | null;
  days_per_week: number | null;
  session_duration: number | null;
  available_days: string[] | null;
  calorie_goal: number | null;
  goal: ProfileGoal | null;
  role: UserRole;
  whatsapp: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

/** A client is just a `profiles` row with role='user'. */
export type Client = Profile;

export interface BodyPart {
  id: string;
  name: string;
}

/** Shared, coach-managed exercise library (`exercises`). Editing a row
 *  propagates live to every routine that references it. */
export interface Exercise {
  id: string;
  name: string;
  video_url: string | null;
  body_part_id: string | null;
  created_at: string;
  updated_at: string;
  body_part?: BodyPart | null;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  day_of_week: string | null; // 'monday'..'sunday'
  assigned_by: string | null;
  source: RoutineSource;
  created_at: string;
  updated_at: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  user_id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  rest_seconds: number;
  sort_order: number;
  notes: string | null;
  created_at: string;
  exercise?: Exercise;
}

export type RoutineWithExercises = Routine & { routine_exercises: RoutineExercise[] };

export interface Meal {
  id: string;
  user_id: string;
  name: string;
  meal_type: MealType;
  date: string; // ISO date
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealItem {
  id: string;
  meal_id: string;
  user_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string | null;
  photo_path: string | null;
  created_at: string;
}

export type MealWithItems = Meal & { meal_items: MealItem[] };

export interface WorkoutLog {
  id: string;
  user_id: string;
  routine_id: string | null;
  routine_name: string;
  date: string; // ISO date
  duration_minutes: number | null;
  notes: string | null;
  completed_exercises: string[] | null;
  created_at: string;
}

export interface Membership {
  id: string;
  client_id: string;
  coach_id: string | null;
  plan_name: string | null;
  status: MembershipStatus;
  price: number | null;
  currency: string | null;
  started_at: string; // ISO date
  expires_at: string | null; // ISO date
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------------- Coach Programs (multi-week periodized training) ----------------
 * Mirrors supabase/migrations/20260717120000_coach_programs.sql. A program is a
 * block: header → days (the split) → exercises (base prescription) + a GLOBAL
 * weekly periodization table that modulates RIR/%load across weeks. */

export type ProgramStatus = 'active' | 'completed' | 'archived';
export type LoadQualitative = 'light' | 'moderate' | 'heavy';

export interface Program {
  id: string;
  user_id: string;
  assigned_by: string | null;
  source: 'coach';
  name: string;
  description: string | null;
  focus: string | null;
  duration_weeks: number;
  start_date: string; // ISO date
  status: ProgramStatus;
  progression_rule: string | null;
  tempo_default: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramExercise {
  id: string;
  program_day_id: string;
  exercise_id: string | null;
  custom_name: string | null;
  sets: number;
  rep_min: number | null;
  rep_max: number | null;
  is_unilateral: boolean;
  rir_min: number | null;
  rir_max: number | null;
  load_pct_1rm: number | null;
  load_qualitative: LoadQualitative | null;
  tempo: string | null;
  rest_seconds: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  exercise?: Exercise | null;
}

export interface ProgramDay {
  id: string;
  program_id: string;
  day_index: number;
  label: string | null;
  weekday: string | null; // 'monday'..'sunday'
  sort_order: number;
  created_at: string;
  program_exercises: ProgramExercise[];
}

export interface ProgramWeek {
  id: string;
  program_id: string;
  week_number: number;
  label: string | null;
  rir_min: number | null;
  rir_max: number | null;
  load_pct_min: number | null;
  load_pct_max: number | null;
  is_deload: boolean;
  sets_override: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProgramWithDetail extends Program {
  program_days: ProgramDay[];
  program_weeks: ProgramWeek[];
}

/** A client's actual logged set (their execution of a prescribed set). */
export interface WorkoutSetLog {
  id: string;
  user_id: string;
  program_exercise_id: string;
  week_number: number;
  date: string; // ISO date
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  created_at: string;
}

/** Shared join shape: a prescription with enough context to label it in the
 *  coach tracking view (exercise name, program, weekly targets). */
export interface ProgramExerciseContext {
  id: string;
  sets: number;
  rep_min: number | null;
  rep_max: number | null;
  is_unilateral: boolean;
  rir_min: number | null;
  rir_max: number | null;
  load_pct_1rm: number | null;
  custom_name: string | null;
  exercise: { name: string } | null;
  program_day: {
    label: string | null;
    program: { id: string; name: string } | null;
  } | null;
}

/** A set log joined to the prescription it was logged against (for the coach
 *  tracking view: actuals vs plan). */
export interface SetLogWithContext extends WorkoutSetLog {
  program_exercise: ProgramExerciseContext | null;
}

/** "Client marked this exercise done for this week" — independent of set
 *  logging (a client can check a day done without entering weight/reps). */
export interface ExerciseCompletion {
  id: string;
  user_id: string;
  program_exercise_id: string;
  week_number: number;
  completed_at: string;
  created_at: string;
}

export interface ExerciseCompletionWithContext extends ExerciseCompletion {
  program_exercise: ProgramExerciseContext | null;
}

/** One line of cross-client activity for the dashboard feed — a client
 *  finished a legacy routine, checked a program exercise done, or logged a
 *  set. Built by services/tracking.ts#getRecentActivity from
 *  program_exercise_completions + workout_set_logs (grouped per session) so
 *  Dashboard doesn't need to know the underlying tables. */
export interface ActivityItem {
  clientId: string;
  clientName: string;
  kind: 'completion' | 'set_log';
  exerciseName: string;
  /** ISO instant — completions use the real completed_at timestamp; grouped
   *  set logs use the log date at local midnight (day precision only). */
  at: string;
}

export interface CoachProfile {
  display_name: string;
  avatar_url: string | null;
  /** International digits, shown to clients inside the mobile app */
  whatsapp: string;
}

/** Full aggregate used by the client DETAIL screen (all tabs read it). */
export interface ClientWithMeta extends Client {
  membership: Membership | null;
  routines: RoutineWithExercises[];
  meals: MealWithItems[];
  logs: WorkoutLog[];
}

/** Lightweight aggregate for the LIST screens (Clients, Dashboard, Memberships).
 *  Deliberately omits routine exercises, meals, and full log rows — the lists
 *  only need routine counts and recent activity, so pulling the full nested
 *  graph for every client was pure waste. */
export interface ClientSummary extends Client {
  membership: Membership | null;
  coachRoutineCount: number;
  selfRoutineCount: number;
  /** Recent workout logs, date-DESC, projected to the fields the lists render. */
  logs: { date: string; routine_name: string }[];
}
