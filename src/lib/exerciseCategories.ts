/**
 * Exercise library categories: the catalog's `target_muscle` (ExerciseDB
 * naming, filled from the exercises dataset — migration
 * 20261023130000_exercise_target_muscle in hokage-coaching-app) folded into
 * the groups a coach browses by. Finer than the six muscle-map groups in
 * lib/muscleMap: biceps, triceps and glutes each get their own card.
 */
import type { Exercise } from '@/types';
import type { BodySlug } from '@/components/muscles/bodyArt';

export type CategoryId =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'glutes'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'cardio'
  | 'neck';

export interface Category {
  id: CategoryId;
  label: string;
  /** target_muscle values that fall in this category. */
  muscles: string[];
  /** How the card's figure is drawn: which side and which muscles lit. */
  side: 'front' | 'back';
  slugs: BodySlug[];
  /** Shown on the card when they're in the catalog; the rest fill up A–Z. */
  featured: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'chest',
    label: 'Pecho',
    muscles: ['pectorals', 'serratus anterior'],
    side: 'front',
    slugs: ['chest'],
    featured: ['Press de Banca Plano', 'Press Inclinado con Mancuernas', 'Aperturas en Máquina (Peck Deck)'],
  },
  {
    id: 'back',
    label: 'Espalda',
    muscles: ['lats', 'upper back', 'traps', 'spine'],
    side: 'back',
    slugs: ['upper-back', 'trapezius', 'lower-back'],
    featured: ['Dominadas con Agarre Prono (Front)', 'Remo Inclinado con Barra (Barbell Row)', 'Remo en Máquina Sentado (Cable Row)'],
  },
  {
    id: 'shoulders',
    label: 'Hombros',
    muscles: ['delts'],
    side: 'front',
    slugs: ['deltoids'],
    featured: ['Elevaciones Laterales (Deltoides Medio)', 'Press de Hombro con Mancuernas', 'Elevación Lateral a 1 Brazo en Polea'],
  },
  {
    id: 'legs',
    label: 'Piernas',
    muscles: ['quads', 'hamstrings', 'calves', 'adductors'],
    side: 'front',
    slugs: ['quadriceps', 'adductors', 'calves', 'tibialis'],
    featured: ['Extensión de Cuádriceps en Máquina Sentado', 'Curl de Femoral Tumbado', 'Máquina de Aductores (Adductor Machine)'],
  },
  {
    id: 'glutes',
    label: 'Glúteos',
    muscles: ['glutes', 'abductors'],
    side: 'back',
    slugs: ['gluteal'],
    featured: ['Hip Thrust con Barra', 'Peso Muerto Rumano (RDL)', 'Máquina de Abductores (Abductor Machine)'],
  },
  {
    id: 'biceps',
    label: 'Bíceps',
    muscles: ['biceps'],
    side: 'front',
    slugs: ['biceps'],
    featured: ['Curl de Bíceps en Inclinado', 'Curl de Bíceps en Polea (Cable Curl)', 'Curl de Bíceps con Agarre Neutro (Martillo)'],
  },
  {
    id: 'triceps',
    label: 'Tríceps',
    muscles: ['triceps'],
    side: 'back',
    slugs: ['triceps'],
    featured: ['Extensiones de Tríceps en Polea (Pushdown)', 'Tríceps con cuerda', 'Fondos de tríceps'],
  },
  {
    id: 'forearms',
    label: 'Antebrazos',
    muscles: ['forearms'],
    side: 'front',
    slugs: ['forearm'],
    featured: ['Curl de Muñeca con Barra', 'Curl de Muñeca Inverso', 'Rodillo de Muñeca (Wrist Roller)'],
  },
  {
    id: 'abs',
    label: 'Abdomen',
    muscles: ['abs'],
    side: 'front',
    slugs: ['abs', 'obliques'],
    featured: ['Abdominales en Máquina', 'Crunch de Rodillas en Polea', 'Rueda Abdominal (Ab Wheel Rollout)'],
  },
  {
    id: 'cardio',
    label: 'Cardio',
    muscles: ['cardiovascular system'],
    side: 'front',
    slugs: ['quadriceps', 'calves', 'chest'],
    featured: ['Correr en la cinta', 'Bicicleta', 'Saltar la Cuerda'],
  },
  {
    id: 'neck',
    label: 'Cuello',
    muscles: ['levator scapulae'],
    side: 'front',
    slugs: ['neck'],
    featured: [],
  },
];

/** Spanish names for every target_muscle value the catalog allows. */
export const MUSCLE_LABEL: Record<string, string> = {
  pectorals: 'Pectorales',
  'serratus anterior': 'Serrato anterior',
  lats: 'Dorsales',
  'upper back': 'Espalda alta',
  traps: 'Trapecio',
  spine: 'Lumbar',
  delts: 'Deltoides',
  quads: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  calves: 'Gemelos',
  adductors: 'Aductores',
  glutes: 'Glúteos',
  abductors: 'Abductores',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  abs: 'Abdominales',
  'cardiovascular system': 'Cardio',
  'levator scapulae': 'Elevador de la escápula',
};

/** Every target_muscle value, in category order (for the editor's select). */
export const MUSCLES: string[] = CATEGORIES.flatMap((c) => c.muscles);

const MUSCLE_CATEGORY = new Map<string, CategoryId>(CATEGORIES.flatMap((c) => c.muscles.map((m) => [m, c.id] as const)));

export const categoryOf = (ex: Pick<Exercise, 'target_muscle'>): CategoryId | null =>
  (ex.target_muscle ? MUSCLE_CATEGORY.get(ex.target_muscle) : undefined) ?? null;

export const findCategory = (id: string | null | undefined): Category | undefined =>
  CATEGORIES.find((c) => c.id === id);

/** Up to three names for a category's card: its featured ones that exist,
 *  then the rest of its exercises A–Z. `list` is already that category's. */
export function sampleNames(cat: Category, list: Exercise[], n = 3): string[] {
  const names = new Set(list.map((e) => e.name));
  const out = cat.featured.filter((f) => names.has(f));
  for (const e of list) {
    if (out.length >= n) break;
    if (!out.includes(e.name)) out.push(e.name);
  }
  return out.slice(0, n);
}
