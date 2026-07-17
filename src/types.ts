/**
 * Hokage Coaching — Admin Panel domain types.
 * Shaped 1:1 like the future Supabase tables so the mock service layer
 * can be swapped for real queries without touching the UI.
 */

export type MembershipStatus = 'active' | 'expired' | 'paused' | 'cancelled';

export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy activo';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Client {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  age: number | null;
  sex: 'M' | 'F' | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel;
  calorie_goal: number;
  onboarding_completed: boolean;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number;
  sort_order: number;
}

export interface Routine {
  id: string;
  user_id: string; // client id
  name: string;
  description: string;
  day_of_week: string; // 'Lunes'…'Domingo'
  /** null = the client made it themselves; a coach id = coach-assigned → red "COACH" badge */
  assigned_by: string | null;
  exercises: Exercise[];
}

export interface MealItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion: string;
}

export interface Meal {
  id: string;
  user_id: string;
  name: string;
  meal_type: MealType;
  date: string; // ISO date
  assigned_by: string | null;
  items: MealItem[];
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  routine_name: string;
  date: string; // ISO date
  duration_minutes: number;
  notes: string;
  completed_exercises: string[];
}

export interface Membership {
  id: string;
  client_id: string;
  plan_name: string;
  status: MembershipStatus;
  price: number;
  currency: 'DOP';
  started_at: string; // ISO date
  expires_at: string | null; // ISO date
  notes: string;
}

export interface CoachProfile {
  display_name: string;
  avatar_url: string | null;
  /** International digits, shown to clients inside the mobile app */
  whatsapp: string;
}

/** Convenience aggregate used by list screens */
export interface ClientWithMeta extends Client {
  membership: Membership;
  routines: Routine[];
  meals: Meal[];
  logs: WorkoutLog[];
}
