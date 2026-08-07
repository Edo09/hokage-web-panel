/**
 * Client-side "Export to PDF" for a nutrition plan and a supplement stack —
 * the shape of the document a coach hands over today, regenerated from
 * structured data.
 *
 * Mirrors lib/programPdf.ts: jsPDF + autotable (deterministic, text-based,
 * selectable — not a screenshot), rendered from the already-loaded graph so
 * there is no extra fetch. Spanish labels to match the panel and the app.
 *
 * A meal table gets one column per day type when the plan cycles, so a coach
 * reading the export sees the same two-column layout their source document had.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { fmtDate } from '@/lib/utils';
import type {
  DayType,
  NutritionPlanMeal,
  NutritionPlanTarget,
  NutritionPlanWithDetail,
  PlanMealType,
  SupplementPlanWithDetail,
  SupplementTier,
  SupplementTiming,
} from '@/types';

type RGB = [number, number, number];
const INK: RGB = [26, 29, 35];
const MUTED: RGB = [107, 114, 128];
const FAINT: RGB = [156, 163, 175];
const LINE: RGB = [229, 231, 235];
const BRAND: RGB = [201, 30, 30];
const BAND: RGB = [244, 245, 247];

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  completed: 'Completado',
  archived: 'Archivado',
};
const MEAL_TYPE: Record<PlanMealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Merienda',
  pre_workout: 'Pre-entrenamiento',
  post_workout: 'Post-entrenamiento',
};
const TIER: Record<SupplementTier, string> = {
  base: 'BASE — OBLIGATORIOS',
  conditional: 'CONDICIONALES — SEGÚN TOLERANCIA',
  optional: 'OPCIONALES — MENOR PRIORIDAD',
};
const TIMING: Record<SupplementTiming, string> = {
  wake: 'Al despertar',
  breakfast: 'Desayuno',
  pre_workout: 'Pre-entreno',
  intra_workout: 'Durante el entreno',
  post_workout: 'Post-entreno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  bedtime: 'Antes de dormir',
  any: 'Cualquier momento',
};
/** Day order — this is what turns the rows into the schedule table. */
const TIMING_ORDER: SupplementTiming[] = [
  'wake',
  'breakfast',
  'pre_workout',
  'intra_workout',
  'post_workout',
  'lunch',
  'dinner',
  'bedtime',
  'any',
];
const TIERS: SupplementTier[] = ['base', 'conditional', 'optional'];
const APPLIES: Record<DayType, string> = {
  both: 'Ambos días',
  training: 'Solo días de entrenamiento',
  rest: 'Solo días de descanso',
};

const num = (a: number | null, b: number | null): string => {
  if (a != null && b != null) return a === b ? String(a) : `${a}–${b}`;
  if (a != null) return String(a);
  if (b != null) return String(b);
  return '—';
};
const safeFile = (s: string): string =>
  s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'plan';

const afterTable = (doc: jsPDF): number =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

const LOGO_RATIO = 1557 / 1594;
let logoPromise: Promise<string | null> | null = null;

/** The brand logo, downscaled once via canvas and cached — same helper as
 *  programPdf. Resolves null if it can't load, so the header degrades to the
 *  wordmark rather than failing the export. */
function loadLogo(): Promise<string | null> {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const w = 220;
        const h = Math.round((img.naturalHeight / img.naturalWidth) * w) || w;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.jpg';
  });
  return logoPromise;
}

/* ---------------- shared chrome ---------------- */

async function drawHeader(
  doc: jsPDF,
  subtitle: string,
  W: number,
  M: number,
  y: number,
): Promise<number> {
  const logo = await loadLogo();
  doc.setFontSize(8).setTextColor(...FAINT);
  doc.text(`Generado ${fmtDate(new Date())}`, W - M, y + 11, { align: 'right' });
  if (logo) {
    const lh = 42;
    const lw = lh * LOGO_RATIO;
    doc.addImage(logo, 'JPEG', M, y, lw, lh);
    doc.setDrawColor(...LINE).setLineWidth(0.5).rect(M, y, lw, lh);
    const tx = M + lw + 12;
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...BRAND);
    doc.text('THE HOKAGE COACHING', tx, y + 18);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED);
    doc.text(subtitle, tx, y + 32);
    y += lh + 8;
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...BRAND);
    doc.text('THE HOKAGE COACHING', M, y + 8);
    y += 16;
  }
  doc.setDrawColor(...LINE).setLineWidth(1).line(M, y, W - M, y);
  return y + 24;
}

function ensureSpace(doc: jsPDF, y: number, need: number, H: number, M: number): number {
  if (y + need > H - M) {
    doc.addPage();
    return M;
  }
  return y;
}

function sectionHeading(doc: jsPDF, text: string, y: number, M: number, contentW: number): number {
  const h = 20;
  doc.setFillColor(...BAND).roundedRect(M, y, contentW, h, 3, 3, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...INK).text(text, M + 8, y + 13.5);
  return y + h + 4;
}

function mealHeading(
  doc: jsPDF,
  meal: NutritionPlanMeal,
  index: number,
  y: number,
  M: number,
  contentW: number,
): number {
  const h = 20;
  doc.setFillColor(...BAND).roundedRect(M, y, contentW, h, 3, 3, 'F');
  const baseline = y + 13.5;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...BRAND);
  const tag = `${index}.`;
  doc.text(tag, M + 8, baseline);
  let x = M + 8 + doc.getTextWidth(tag) + 6;

  const title = (meal.label ?? MEAL_TYPE[meal.meal_type]).toUpperCase();
  doc.setTextColor(...INK).text(title, x, baseline);
  x += doc.getTextWidth(title) + 8;

  const bits: string[] = [];
  if (meal.applies_to !== 'both') bits.push(APPLIES[meal.applies_to].toLowerCase());
  if (meal.is_optional) bits.push('opcional');
  if (meal.time_hint) bits.push(meal.time_hint);
  if (bits.length) {
    doc.setFont('helvetica', 'normal').setTextColor(...MUTED).text(`(${bits.join(' · ')})`, x, baseline);
  }
  return y + h + 4;
}

function stampFooters(doc: jsPDF, title: string, W: number, H: number, M: number): void {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE).setLineWidth(0.5).line(M, H - 30, W - M, H - 30);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...FAINT);
    doc.text(`The Hokage Coaching · ${title}`, M, H - 18);
    doc.text(`Página ${i} / ${pages}`, W - M, H - 18, { align: 'right' });
  }
}

/** Foods of an option that survive a given day. */
const foodsOn = (
  opt: NutritionPlanMeal['nutrition_plan_options'][number],
  day: Exclude<DayType, 'both'>,
): string =>
  opt.nutrition_plan_option_items
    .filter((i) => i.day_type === 'both' || i.day_type === day)
    .map((i) => i.name)
    .join(', ') || '—';

const targetRow = (t: NutritionPlanTarget): string[] => [
  t.day_type === 'training' ? 'Entrenamiento' : t.day_type === 'rest' ? 'Descanso' : 'Todos los días',
  num(t.kcal_min, t.kcal_max) === '—' ? '—' : `${num(t.kcal_min, t.kcal_max)} kcal`,
  num(t.protein_min_g, t.protein_max_g) === '—' ? '—' : `${num(t.protein_min_g, t.protein_max_g)} g`,
  num(t.carbs_min_g, t.carbs_max_g) === '—' ? '—' : `${num(t.carbs_min_g, t.carbs_max_g)} g`,
  num(t.fat_min_g, t.fat_max_g) === '—' ? '—' : `${num(t.fat_min_g, t.fat_max_g)} g`,
];

/* ---------------- nutrition plan ---------------- */

export async function exportNutritionPdf(
  plan: NutritionPlanWithDetail,
  clientName: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const contentW = W - M * 2;
  let y = M;

  y = await drawHeader(doc, 'Plan nutricional', W, M, y);

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK);
  const titleLines = doc.splitTextToSize(plan.name, contentW) as string[];
  doc.text(titleLines, M, y);
  y += titleLines.length * 20;

  if (plan.focus) {
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...MUTED);
    doc.text(plan.focus, M, y);
    y += 16;
  }

  const mealCount = plan.nutrition_plan_meals.length;
  const meta = [
    `Cliente: ${clientName}`,
    `${mealCount} ${mealCount === 1 ? 'comida' : 'comidas'}`,
    plan.day_cycling ? 'Con ciclado de carbohidratos' : 'Sin ciclado',
    plan.duration_weeks != null
      ? `${plan.duration_weeks} ${plan.duration_weeks === 1 ? 'semana' : 'semanas'}`
      : 'Sin duración fija',
    `Inicio ${fmtDate(plan.start_date)}`,
    STATUS_LABEL[plan.status] ?? plan.status,
  ].join('   ·   ');
  doc.setFontSize(9.5).setTextColor(...MUTED);
  const metaLines = doc.splitTextToSize(meta, contentW) as string[];
  doc.text(metaLines, M, y);
  y += metaLines.length * 13 + 6;

  if (plan.description || plan.notes) {
    doc.setFontSize(9);
    for (const [k, v] of [
      ['Descripción', plan.description],
      ['Notas', plan.notes],
    ] as [string, string | null][]) {
      if (!v) continue;
      const lines = doc.splitTextToSize(`${k}: ${v}`, contentW) as string[];
      doc.setTextColor(...MUTED).text(lines, M, y);
      y += lines.length * 12;
    }
    y += 8;
  }

  // Macro targets first — they frame everything below.
  const targets = plan.nutrition_plan_targets;
  if (targets.length > 0) {
    y = ensureSpace(doc, y, 72, H, M);
    y = sectionHeading(doc, 'DISTRIBUCIÓN APROXIMADA', y, M, contentW);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Parámetro', 'Calorías', 'Proteína', 'Carbohidratos', 'Grasas']],
      body: targets.map(targetRow),
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.5,
        valign: 'middle',
      },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 116, fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
      },
    });
    y = afterTable(doc) + 16;
  }

  // One table per meal slot. When the plan cycles, the two content columns
  // reproduce the source document's own layout.
  const meals = [...plan.nutrition_plan_meals].sort(
    (a, b) => a.sort_order - b.sort_order || a.slot_index - b.slot_index,
  );
  for (const [i, meal] of meals.entries()) {
    y = ensureSpace(doc, y, 72, H, M);
    y = mealHeading(doc, meal, i + 1, y, M, contentW);

    const options = [...meal.nutrition_plan_options].sort((a, b) => a.sort_order - b.sort_order);
    const head = plan.day_cycling
      ? [['Rotación', 'Días de entrenamiento', 'Días de descanso']]
      : [['Rotación', 'Contenido']];
    const body = options.map((o, oi) => {
      const label = o.label ?? `Opción ${oi + 1}`;
      if (!plan.day_cycling) {
        return [label, o.nutrition_plan_option_items.map((it) => it.name).join(', ') || '—'];
      }
      // A slot gated to one day type shows a dash in the other column rather
      // than repeating its foods where they don't apply.
      return [
        label,
        meal.applies_to === 'rest' ? '—' : foodsOn(o, 'training'),
        meal.applies_to === 'training' ? '—' : foodsOn(o, 'rest'),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head,
      body,
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.5,
        valign: 'middle',
      },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      columnStyles: { 0: { cellWidth: 96, fontStyle: 'bold' } },
    });
    y = afterTable(doc);

    if (meal.notes) {
      const lines = doc.splitTextToSize(`Nota: ${meal.notes}`, contentW) as string[];
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
      doc.text(lines, M, y + 11);
      y += lines.length * 11 + 4;
    }
    y += 14;
  }

  stampFooters(doc, plan.name, W, H, M);
  doc.save(`Nutricion - ${safeFile(clientName)} - ${safeFile(plan.name)}.pdf`);
}

/* ---------------- supplement plan ---------------- */

export async function exportSupplementPdf(
  plan: SupplementPlanWithDetail,
  clientName: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const contentW = W - M * 2;
  let y = M;

  y = await drawHeader(doc, 'Suplementación', W, M, y);

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK);
  const titleLines = doc.splitTextToSize(plan.name, contentW) as string[];
  doc.text(titleLines, M, y);
  y += titleLines.length * 20;

  const meta = [
    `Cliente: ${clientName}`,
    `${plan.supplement_plan_items.length} suplementos`,
    `Inicio ${fmtDate(plan.start_date)}`,
    STATUS_LABEL[plan.status] ?? plan.status,
  ].join('   ·   ');
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTED);
  const metaLines = doc.splitTextToSize(meta, contentW) as string[];
  doc.text(metaLines, M, y);
  y += metaLines.length * 13 + 6;

  if (plan.description) {
    const lines = doc.splitTextToSize(plan.description, contentW) as string[];
    doc.setFontSize(9).setTextColor(...MUTED).text(lines, M, y);
    y += lines.length * 12 + 8;
  }

  const items = [...plan.supplement_plan_items].sort((a, b) => a.sort_order - b.sort_order);

  // One table per tier — the coach's own A/B/C sectioning.
  for (const tier of TIERS) {
    const rows = items.filter((i) => i.tier === tier);
    if (rows.length === 0) continue;
    y = ensureSpace(doc, y, 72, H, M);
    y = sectionHeading(doc, TIER[tier], y, M, contentW);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Suplemento', 'Dosis', 'Momento', 'Objetivo / notas']],
      body: rows.map((i) => [
        i.name,
        i.dose ?? '—',
        i.timing_note ?? TIMING[i.timing_slot],
        [i.purpose, i.notes, i.applies_to !== 'both' ? APPLIES[i.applies_to] : null]
          .filter(Boolean)
          .join(' · ') || '—',
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.5,
        valign: 'middle',
      },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      columnStyles: {
        0: { cellWidth: 108, fontStyle: 'bold' },
        1: { cellWidth: 96 },
        2: { cellWidth: 120, textColor: MUTED },
        3: { textColor: MUTED },
      },
    });
    y = afterTable(doc) + 16;
  }

  // The schedule table — DERIVED by grouping on timing_slot, never stored.
  const bySlot = TIMING_ORDER.map((slot) => ({
    slot,
    items: items.filter((i) => i.timing_slot === slot),
  })).filter((g) => g.items.length > 0);

  if (bySlot.length > 0) {
    y = ensureSpace(doc, y, 72, H, M);
    y = sectionHeading(doc, 'HORARIO DE SUPLEMENTACIÓN', y, M, contentW);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Horario', 'Suplemento']],
      body: bySlot.map((g) => [
        TIMING[g.slot],
        g.items.map((i) => (i.dose ? `${i.name} (${i.dose})` : i.name)).join(' + '),
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.5,
        valign: 'middle',
      },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 132, fontStyle: 'bold' } },
    });
    y = afterTable(doc) + 12;
  }

  if (plan.notes) {
    const lines = doc.splitTextToSize(`Notas: ${plan.notes}`, contentW) as string[];
    y = ensureSpace(doc, y, lines.length * 12 + 12, H, M);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED);
    doc.text(lines, M, y + 10);
  }

  stampFooters(doc, plan.name, W, H, M);
  doc.save(`Suplementacion - ${safeFile(clientName)} - ${safeFile(plan.name)}.pdf`);
}
