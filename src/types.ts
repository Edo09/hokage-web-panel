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

export interface CoachProfile {
  display_name: string;
  avatar_url: string | null;
  /** International digits, shown to clients inside the mobile app */
  whatsapp: string;
}

/** Convenience aggregate used by list/detail screens. */
export interface ClientWithMeta extends Client {
  membership: Membership | null;
  routines: RoutineWithExercises[];
  meals: MealWithItems[];
  logs: WorkoutLog[];
}
