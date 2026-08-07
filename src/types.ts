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
  account_type: 'coached' | 'solo';
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
  // Step-by-step "how to" (jsonb arrays of strings), en + es.
  instructions_en: string[] | null;
  instructions_es: string[] | null;
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
  /** Set when the client logged this from a prescribed nutrition-plan option —
   *  the adherence link. Null for free-form entries. */
  plan_option_id: string | null;
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
  /** null on a TEMPLATE (library blueprint with no client). */
  user_id: string | null;
  assigned_by: string | null;
  source: 'coach';
  /** true = reusable library template, never visible to any client. */
  is_template: boolean;
  /** On an assigned copy: the template it was created from. */
  template_id: string | null;
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

/** One client currently carrying a copy of a template (Programs page). */
export interface TemplateAssignment {
  program_id: string;
  template_id: string;
  client_id: string;
  client_name: string;
  status: ProgramStatus;
  start_date: string;
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

/** One line of cross-client PROGRAM activity for the dashboard feed — a client
 *  checked an exercise done, or logged sets for one. Built by
 *  services/tracking.ts#getRecentActivity from program_exercise_completions +
 *  workout_set_logs (set logs deduped per client/exercise/day), so Dashboard
 *  can merge it with the existing legacy workout_logs feed without knowing the
 *  underlying tables. Dashboard formats the display text from kind + name. */
export interface ActivityItem {
  clientId: string;
  clientName: string;
  kind: 'completion' | 'set_log';
  exerciseName: string;
  /** ISO instant (or bare date for set logs) for sorting. */
  at: string;
}

/* ---------------- Coach Nutrition & Supplementation ----------------
 * Mirrors supabase/migrations/20260807120000_nutrition_plans.sql and
 * 20260807120100_supplement_plans.sql. Two INDEPENDENTLY assignable plans, each
 * with its own template library — a coach swaps diets far more often than
 * supplement stacks.
 *
 * A nutrition plan is: header → meal slots → rotation options → foods, plus a
 * macro target table per day type. day_type sits on the FOOD, not the option:
 * "Almuerzo Día 1-2" is one option holding rice (training only) and chicken
 * (both), which is how carb cycling is expressed.
 *
 * Foods carry a name and nothing else — no quantity, no macros. The coach
 * prescribes WHAT to eat; every number is measured later from the client's
 * photo by the AI estimator. The only figures a coach types are the plan-level
 * targets. */

/** Nutrition and supplement plans share the programs status vocabulary, so the
 *  STATUS_LABEL / STATUS_BADGE maps in lib/programStatus.ts apply unchanged. */
export type PlanStatus = ProgramStatus;

/** Which kind of day a food, slot, or supplement survives on. */
export type DayType = 'both' | 'training' | 'rest';

/** Six slots, but meals.meal_type only allows four — pre_workout/post_workout
 *  collapse to 'snack' when a prescription is written into the diary. */
export type PlanMealType = MealType | 'pre_workout' | 'post_workout';

export type SupplementTier = 'base' | 'conditional' | 'optional';

/** The schedule table at the end of a supplement plan is a group-by over this. */
export type SupplementTiming =
  | 'wake'
  | 'breakfast'
  | 'pre_workout'
  | 'intra_workout'
  | 'post_workout'
  | 'lunch'
  | 'dinner'
  | 'bedtime'
  | 'any';

export interface NutritionPlan {
  id: string;
  /** null on a TEMPLATE (library blueprint with no client). */
  user_id: string | null;
  assigned_by: string | null;
  source: 'coach';
  is_template: boolean;
  template_id: string | null;
  name: string;
  description: string | null;
  focus: string | null;
  /** null = open-ended phase; the client sees no week counter. */
  duration_weeks: number | null;
  start_date: string; // ISO date
  status: PlanStatus;
  /** false collapses the UI to a single day type and one 'both' target row. */
  day_cycling: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionPlanTarget {
  id: string;
  plan_id: string;
  day_type: DayType;
  kcal_min: number | null;
  kcal_max: number | null;
  protein_min_g: number | null;
  protein_max_g: number | null;
  carbs_min_g: number | null;
  carbs_max_g: number | null;
  fat_min_g: number | null;
  fat_max_g: number | null;
  notes: string | null;
  created_at: string;
}

/** A single food. Name is free text, so a coach who wants a portion stated just
 *  types it ("Arroz 110 g") — there is no structured quantity. */
export interface NutritionPlanOptionItem {
  id: string;
  option_id: string;
  name: string;
  day_type: DayType;
  sort_order: number;
  created_at: string;
}

/** One rotation choice within a slot — "Opción 1", "Día 1-2". */
export interface NutritionPlanOption {
  id: string;
  plan_meal_id: string;
  label: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  nutrition_plan_option_items: NutritionPlanOptionItem[];
}

export interface NutritionPlanMeal {
  id: string;
  plan_id: string;
  slot_index: number;
  label: string | null;
  meal_type: PlanMealType;
  time_hint: string | null;
  /** Gates the whole slot: post-workout is 'training', so it disappears on a
   *  rest day — but its `notes` still carry the substitution to read. */
  applies_to: DayType;
  is_optional: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  nutrition_plan_options: NutritionPlanOption[];
}

export type NutritionPlanWithDetail = NutritionPlan & {
  nutrition_plan_meals: NutritionPlanMeal[];
  nutrition_plan_targets: NutritionPlanTarget[];
};

export interface SupplementPlan {
  id: string;
  user_id: string | null;
  assigned_by: string | null;
  source: 'coach';
  is_template: boolean;
  template_id: string | null;
  name: string;
  description: string | null;
  start_date: string; // ISO date
  status: PlanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplementPlanItem {
  id: string;
  plan_id: string;
  name: string;
  tier: SupplementTier;
  dose: string | null;
  timing_slot: SupplementTiming;
  timing_note: string | null;
  purpose: string | null;
  notes: string | null;
  applies_to: DayType;
  sort_order: number;
  created_at: string;
}

export type SupplementPlanWithDetail = SupplementPlan & {
  supplement_plan_items: SupplementPlanItem[];
};

/** One client currently carrying a copy of a nutrition or supplement template.
 *  The plan-side twin of TemplateAssignment. */
export interface PlanAssignment {
  plan_id: string;
  template_id: string;
  client_id: string;
  client_name: string;
  status: PlanStatus;
  start_date: string;
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
  /** Assigned nutrition/supplement plans, newest first. Independently
   *  assignable, so a client may have one, both, or neither. */
  nutritionPlans: NutritionPlanWithDetail[];
  supplementPlans: SupplementPlanWithDetail[];
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
