/**
 * Icons and short names for the nutrition vocabulary, so every screen shows a
 * meal, a day type or a supplement timing the same way.
 */
import {
  Activity,
  Apple,
  BedDouble,
  BicepsFlexed,
  CalendarDays,
  Clock3,
  Coffee,
  Dumbbell,
  Moon,
  Soup,
  Sunrise,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { DayType, PlanMealType, SupplementTier, SupplementTiming } from '@/types';

export const MEAL_ICON: Record<PlanMealType, LucideIcon> = {
  breakfast: Coffee,
  lunch: UtensilsCrossed,
  dinner: Soup,
  snack: Apple,
  pre_workout: Zap,
  post_workout: BicepsFlexed,
};

export interface DayMeta {
  /** For a whole meal or target card: "Solo entreno". */
  label: string;
  /** Inline, next to a food: "Entreno". */
  short: string;
  /** Card titles: "Días de entreno". */
  title: string;
  icon: LucideIcon;
  /** Text colour class. */
  tone: string;
  /** Tinted chip classes. */
  chip: string;
}

export const DAY_META: Record<DayType, DayMeta> = {
  both: {
    label: 'Ambos días',
    short: 'Ambos',
    title: 'Todos los días',
    icon: CalendarDays,
    tone: 'text-muted-foreground',
    chip: 'border-border text-muted-foreground',
  },
  training: {
    label: 'Solo entreno',
    short: 'Entreno',
    title: 'Días de entreno',
    icon: Dumbbell,
    tone: 'text-training',
    chip: 'border-training/40 bg-training/10 text-training',
  },
  rest: {
    label: 'Solo descanso',
    short: 'Descanso',
    title: 'Días de descanso',
    icon: BedDouble,
    tone: 'text-rest',
    chip: 'border-rest/40 bg-rest/10 text-rest',
  },
};

/** In the order they fall in a day — this order IS the client's schedule. */
export const TIMINGS: { value: SupplementTiming; label: string; icon: LucideIcon }[] = [
  { value: 'wake', label: 'Al despertar', icon: Sunrise },
  { value: 'breakfast', label: 'Desayuno', icon: Coffee },
  { value: 'pre_workout', label: 'Pre-entreno', icon: Zap },
  { value: 'intra_workout', label: 'Durante el entreno', icon: Activity },
  { value: 'post_workout', label: 'Post-entreno', icon: BicepsFlexed },
  { value: 'lunch', label: 'Almuerzo', icon: UtensilsCrossed },
  { value: 'dinner', label: 'Cena', icon: Soup },
  { value: 'bedtime', label: 'Antes de dormir', icon: Moon },
  { value: 'any', label: 'Cualquier momento', icon: Clock3 },
];

export const TIERS: { value: SupplementTier; label: string; tip: string }[] = [
  { value: 'base', label: 'Base', tip: 'Los que debe tomar sí o sí.' },
  { value: 'conditional', label: 'Condicionales', tip: 'Según tolerancia o preferencia del cliente.' },
  { value: 'optional', label: 'Opcionales', tip: 'Menor prioridad: suman, pero no son clave.' },
];

/** kcal per gram — the only nutrition maths the panel does. */
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;
