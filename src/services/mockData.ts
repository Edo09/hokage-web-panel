/**
 * Mock dataset for the Hokage Coaching admin panel.
 * 14 realistic Dominican clients, prices in DOP.
 * Dates are generated relative to "today" so the demo stays alive.
 * The service layer (services/clients.ts) is the only consumer;
 * when Supabase lands, this file disappears.
 */
import type {
  ActivityLevel,
  ClientWithMeta,
  CoachProfile,
  Exercise,
  Meal,
  MealType,
  MembershipStatus,
  Routine,
  WorkoutLog,
} from '../types';

const DAY = 86_400_000;
const TODAY = new Date();

const iso = (offsetDays: number) => new Date(TODAY.getTime() + offsetDays * DAY).toISOString();

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface Seed {
  name: string;
  age: number;
  sex: 'M' | 'F';
  h: number;
  w: number;
  act: ActivityLevel;
  cal: number;
  plan: string;
  price: number;
  status: MembershipStatus;
  startD: number;
  expD: number | null;
  notes?: string;
}

const SEEDS: Seed[] = [
  { name: 'Luis Peralta', age: 28, sex: 'M', h: 178, w: 82, act: 'moderado', cal: 2800, plan: 'Coaching Premium', price: 4500, status: 'active', startD: -178, expD: 34 },
  { name: 'María Fernández', age: 34, sex: 'F', h: 164, w: 61, act: 'activo', cal: 1900, plan: 'Plan Mensual', price: 2500, status: 'active', startD: -26, expD: 4 },
  { name: 'Carlos Rodríguez', age: 41, sex: 'M', h: 172, w: 90, act: 'ligero', cal: 2400, plan: 'Plan Trimestral', price: 6500, status: 'active', startD: -34, expD: 57 },
  { name: 'Ana Batista', age: 26, sex: 'F', h: 160, w: 55, act: 'moderado', cal: 1750, plan: 'Plan Mensual', price: 2500, status: 'active', startD: -24, expD: 6 },
  { name: 'José Martínez', age: 31, sex: 'M', h: 181, w: 88, act: 'activo', cal: 3000, plan: 'Coaching Premium', price: 4500, status: 'active', startD: -80, expD: 100 },
  { name: 'Carmen Santos', age: 45, sex: 'F', h: 158, w: 70, act: 'sedentario', cal: 1600, plan: 'Plan Mensual', price: 2500, status: 'expired', startD: -39, expD: -9, notes: 'Prefiere entrenar en las mañanas.' },
  { name: 'Pedro Guzmán', age: 23, sex: 'M', h: 175, w: 72, act: 'muy activo', cal: 3200, plan: 'Plan Trimestral', price: 6500, status: 'active', startD: -45, expD: 46 },
  { name: 'Laura Jiménez', age: 29, sex: 'F', h: 167, w: 63, act: 'moderado', cal: 1850, plan: 'Plan Mensual', price: 2500, status: 'paused', startD: -50, expD: 40, notes: 'Viaje de trabajo — retoma en agosto.' },
  { name: 'Miguel de la Cruz', age: 38, sex: 'M', h: 169, w: 95, act: 'ligero', cal: 2200, plan: 'Coaching Premium', price: 4500, status: 'active', startD: -120, expD: 85 },
  { name: 'Yesenia Rosario', age: 27, sex: 'F', h: 162, w: 58, act: 'activo', cal: 2000, plan: 'Plan Mensual', price: 2500, status: 'active', startD: -12, expD: 18 },
  { name: 'Rafael Núñez', age: 52, sex: 'M', h: 174, w: 86, act: 'ligero', cal: 2100, plan: 'Plan Trimestral', price: 6500, status: 'expired', startD: -128, expD: -38 },
  { name: 'Daniela Castillo', age: 22, sex: 'F', h: 165, w: 60, act: 'moderado', cal: 1800, plan: 'Plan Mensual', price: 2500, status: 'active', startD: -7, expD: 23 },
  { name: 'Frankelly Mota', age: 35, sex: 'M', h: 180, w: 84, act: 'activo', cal: 2900, plan: 'Plan Mensual', price: 2500, status: 'cancelled', startD: -95, expD: -20, notes: 'Se mudó a Santiago.' },
  { name: 'Rosa Herrera', age: 48, sex: 'F', h: 156, w: 68, act: 'ligero', cal: 1650, plan: 'Plan Mensual', price: 2500, status: 'active', startD: -63, expD: 29 },
];

type ExTuple = [name: string, sets: number, reps: number, weightKg: number, restSeconds: number];

const ROUTINE_TEMPLATES: { name: string; desc: string; ex: ExTuple[] }[] = [
  {
    name: 'Empuje — Pecho y Hombro',
    desc: 'Fuerza de empuje: pecho, hombro y tríceps.',
    ex: [
      ['Press de banca', 4, 8, 60, 90],
      ['Press militar', 3, 10, 35, 90],
      ['Fondos en paralelas', 3, 12, 0, 75],
      ['Elevaciones laterales', 3, 15, 8, 60],
    ],
  },
  {
    name: 'Tirón — Espalda y Bíceps',
    desc: 'Espalda completa y bíceps.',
    ex: [
      ['Dominadas', 4, 8, 0, 120],
      ['Remo con barra', 4, 10, 50, 90],
      ['Curl con mancuernas', 3, 12, 14, 60],
      ['Face pull', 3, 15, 20, 60],
    ],
  },
  {
    name: 'Pierna completa',
    desc: 'Cuádriceps, femoral y glúteo.',
    ex: [
      ['Sentadilla trasera', 4, 8, 80, 150],
      ['Peso muerto rumano', 3, 10, 70, 120],
      ['Prensa de pierna', 3, 12, 120, 90],
      ['Elevación de talones', 4, 15, 40, 60],
    ],
  },
  {
    name: 'Full body express',
    desc: 'Sesión completa en 45 minutos.',
    ex: [
      ['Sentadilla goblet', 3, 12, 24, 75],
      ['Press con mancuernas', 3, 10, 26, 75],
      ['Remo en máquina', 3, 12, 45, 75],
      ['Plancha', 3, 45, 0, 45],
    ],
  },
  {
    name: 'Cardio y core',
    desc: 'Resistencia cardiovascular y abdomen.',
    ex: [
      ['Cinta — intervalos', 1, 20, 0, 60],
      ['Mountain climbers', 3, 30, 0, 45],
      ['Plancha lateral', 3, 30, 0, 45],
      ['Rueda abdominal', 3, 12, 0, 60],
    ],
  },
];

const SELF_ROUTINE: { name: string; desc: string; ex: ExTuple[] } = {
  name: 'Mi rutina de brazo',
  desc: 'Bíceps y tríceps por mi cuenta.',
  ex: [
    ['Curl con barra', 4, 10, 30, 60],
    ['Extensión en polea', 4, 12, 25, 60],
    ['Curl martillo', 3, 12, 12, 60],
  ],
};

type ItemTuple = [name: string, calories: number, protein: number, carbs: number, fat: number, portion: string];

const MEAL_PLAN: { name: string; meal_type: MealType; items: ItemTuple[] }[] = [
  {
    name: 'Desayuno alto en proteína',
    meal_type: 'breakfast',
    items: [
      ['Avena con guineo', 320, 12, 55, 6, '1 taza'],
      ['Huevos revueltos', 210, 18, 2, 15, '3 unidades'],
      ['Café negro', 5, 0, 1, 0, '1 taza'],
    ],
  },
  {
    name: 'Almuerzo criollo fit',
    meal_type: 'lunch',
    items: [
      ['Pechuga a la plancha', 280, 52, 0, 6, '200 g'],
      ['Arroz blanco', 260, 5, 56, 1, '1 taza'],
      ['Habichuelas guisadas', 120, 8, 20, 1, '1/2 taza'],
      ['Ensalada verde', 60, 2, 8, 3, '1 plato'],
    ],
  },
  {
    name: 'Cena ligera',
    meal_type: 'dinner',
    items: [
      ['Pescado al horno', 240, 40, 0, 8, '180 g'],
      ['Batata asada', 180, 3, 41, 0, '150 g'],
    ],
  },
  {
    name: 'Merienda',
    meal_type: 'snack',
    items: [
      ['Yogur griego', 140, 15, 8, 5, '1 envase'],
      ['Almendras', 160, 6, 6, 14, '28 g'],
    ],
  },
];

const LOG_NOTES = [
  'Subí 2.5 kg en el ejercicio principal.',
  'Poca energía, bajé el volumen.',
  'Récord personal en sentadilla.',
  'Terminé con 10 min de cardio.',
];

const FREQ: Record<ActivityLevel, number> = {
  sedentario: 1,
  ligero: 2,
  moderado: 3,
  activo: 4,
  'muy activo': 5,
};

const toExercises = (ex: ExTuple[]): Exercise[] =>
  ex.map(([name, sets, reps, weight_kg, rest_seconds], sort_order) => ({
    name,
    sets,
    reps,
    weight_kg,
    rest_seconds,
    sort_order,
  }));

const slugEmail = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '')
    .trim()
    .replace(/ +/g, '.') + '@gmail.com';

function build(): ClientWithMeta[] {
  return SEEDS.map((s, i) => {
    const id = `c${i + 1}`;

    const routines: Routine[] = [];
    const n = 1 + (i % 3);
    for (let k = 0; k < n; k++) {
      const t = ROUTINE_TEMPLATES[(i + k) % ROUTINE_TEMPLATES.length];
      routines.push({
        id: `r${i}${k}`,
        user_id: id,
        name: t.name,
        description: t.desc,
        day_of_week: DAYS[(i + k * 2) % 6],
        assigned_by: 'coach',
        exercises: toExercises(t.ex),
      });
    }
    if (i % 4 === 1) {
      routines.push({
        id: `rs${i}`,
        user_id: id,
        name: SELF_ROUTINE.name,
        description: SELF_ROUTINE.desc,
        day_of_week: 'Sábado',
        assigned_by: null,
        exercises: toExercises(SELF_ROUTINE.ex),
      });
    }

    // Deterministic pseudo-random workout logs over the last 6 weeks
    let seed = i * 7 + 3;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const logs: WorkoutLog[] = [];
    for (let d = 42; d >= 0; d--) {
      if ((s.status === 'expired' || s.status === 'cancelled') && s.expD !== null && -d > s.expD) continue;
      if (s.status === 'paused' && d < 14) continue;
      if (rnd() < FREQ[s.act] / 7 && routines.length) {
        const rt = routines[Math.floor(rnd() * routines.length)];
        logs.push({
          id: `l${i}_${d}`,
          user_id: id,
          routine_name: rt.name,
          date: iso(-d),
          duration_minutes: 40 + Math.floor(rnd() * 35),
          notes: rnd() < 0.25 ? LOG_NOTES[Math.floor(rnd() * LOG_NOTES.length)] : '',
          completed_exercises: rt.exercises.map((e) => e.name),
        });
      }
    }

    const meals: Meal[] = [0, 4, 8].includes(i)
      ? MEAL_PLAN.map((m, k) => ({
          id: `me${i}${k}`,
          user_id: id,
          name: m.name,
          meal_type: m.meal_type,
          date: iso(0),
          assigned_by: 'coach',
          items: m.items.map(([name, calories, protein_g, carbs_g, fat_g, portion]) => ({
            name,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            portion,
          })),
        }))
      : [];

    return {
      id,
      display_name: s.name,
      email: slugEmail(s.name),
      avatar_url: null,
      age: s.age,
      sex: s.sex,
      height_cm: s.h,
      weight_kg: s.w,
      activity_level: s.act,
      calorie_goal: s.cal,
      onboarding_completed: true,
      membership: {
        id: `m${i + 1}`,
        client_id: id,
        plan_name: s.plan,
        status: s.status,
        price: s.price,
        currency: 'DOP',
        started_at: iso(s.startD),
        expires_at: s.expD === null ? null : iso(s.expD),
        notes: s.notes ?? '',
      },
      routines,
      meals,
      logs,
    };
  });
}

export const MOCK_CLIENTS: ClientWithMeta[] = build();

export const MOCK_COACH: CoachProfile = {
  display_name: 'Edwin',
  avatar_url: null,
  whatsapp: '18095551234',
};

/** Active-clients trend for the dashboard area chart (last 12 weeks). */
export const MOCK_CLIENT_TREND = [5, 6, 6, 7, 8, 8, 9, 10, 10, 9, 9, 9];
