/**
 * Client-side "Export to PDF" for a coach program. Renders the full block —
 * header, coach notes, each day's exercise table, and the weekly periodization
 * table — into a paginated A4 document the coach can download and share with the
 * client. Built with jsPDF + autotable (deterministic, text-based, selectable —
 * not a screenshot), all from the already-loaded ProgramWithDetail graph, so no
 * extra fetch. Spanish labels to match the panel and the client's app.
 */
import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData } from 'jspdf-autotable';

import { fmtDate } from '@/lib/utils';
import type { LoadQualitative, ProgramDay, ProgramExercise, ProgramWeek, ProgramWithDetail } from '@/types';

type RGB = [number, number, number];
const INK: RGB = [26, 29, 35];
const MUTED: RGB = [107, 114, 128];
const FAINT: RGB = [156, 163, 175];
const LINE: RGB = [229, 231, 235];
const BRAND: RGB = [201, 30, 30];
const BAND: RGB = [244, 245, 247];
const DELOAD: RGB = [250, 240, 240];

const STATUS_LABEL: Record<string, string> = { active: 'Activo', completed: 'Completado', archived: 'Archivado' };
const LOAD_QUAL: Record<LoadQualitative, string> = { light: 'Ligero', moderate: 'Moderado', heavy: 'Pesado' };
const WEEKDAY: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const rangeText = (a: number | null, b: number | null): string => {
  if (a != null && b != null) return a === b ? String(a) : `${a}–${b}`;
  if (a != null) return String(a);
  if (b != null) return String(b);
  return '—';
};
const exerciseName = (e: ProgramExercise): string => e.exercise?.name ?? e.custom_name ?? 'Ejercicio';
const loadText = (e: ProgramExercise): string =>
  e.load_pct_1rm != null ? `${e.load_pct_1rm}% 1RM` : e.load_qualitative ? LOAD_QUAL[e.load_qualitative] : '—';
const detailText = (e: ProgramExercise): string => {
  const bits: string[] = [];
  const rir = rangeText(e.rir_min, e.rir_max);
  if (rir !== '—') bits.push(`RIR ${rir}`);
  if (e.tempo) bits.push(`Tempo ${e.tempo}`);
  if (e.is_unilateral) bits.push('Por lado');
  if (e.notes) bits.push(e.notes);
  return bits.join(' · ') || '—';
};
const weekHasData = (w: ProgramWeek): boolean =>
  !!(w.label || w.rir_min != null || w.rir_max != null || w.load_pct_min != null || w.load_pct_max != null || w.is_deload || w.sets_override != null);
const safeFile = (s: string): string => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'programa';

/** finalY of the most recently drawn autotable. */
const afterTable = (doc: jsPDF): number => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

const LOGO_RATIO = 1557 / 1594; // logo.jpg width/height
let logoPromise: Promise<string | null> | null = null;

/**
 * The brand logo (public/logo.jpg) as a small JPEG data URI, downscaled once via
 * canvas and cached — the source is 169 KB / 1557², far too big to embed at full
 * size in every PDF. Resolves null if the image can't load, so the header falls
 * back to the plain wordmark rather than failing the export.
 */
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

export async function exportProgramPdf(program: ProgramWithDetail, clientName: string): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const contentW = W - M * 2;
  let y = M;

  // Header: logo badge + wordmark (falls back to wordmark alone), generated
  // stamp, then a rule.
  const logo = await loadLogo();
  doc.setFontSize(8).setTextColor(...FAINT);
  doc.text(`Generado ${fmtDate(new Date())}`, W - M, y + 11, { align: 'right' });
  if (logo) {
    const lh = 42;
    const lw = lh * LOGO_RATIO;
    doc.addImage(logo, 'JPEG', M, y, lw, lh);
    doc.setDrawColor(...LINE).setLineWidth(0.5).rect(M, y, lw, lh); // hairline frames the dark badge
    const tx = M + lw + 12;
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...BRAND);
    doc.text('THE HOKAGE COACHING', tx, y + 18);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED);
    doc.text('Plan de entrenamiento', tx, y + 32);
    y += lh + 8;
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...BRAND);
    doc.text('THE HOKAGE COACHING', M, y + 8);
    y += 16;
  }
  doc.setDrawColor(...LINE).setLineWidth(1).line(M, y, W - M, y);
  y += 24;

  // Title.
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK);
  const titleLines = doc.splitTextToSize(program.name, contentW) as string[];
  doc.text(titleLines, M, y);
  y += titleLines.length * 20;

  if (program.focus) {
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...MUTED);
    doc.text(program.focus, M, y);
    y += 16;
  }

  // Meta line.
  const dayCount = program.program_days.length;
  const exCount = program.program_days.reduce((a, d) => a + d.program_exercises.length, 0);
  const meta = [
    `Cliente: ${clientName}`,
    `${program.duration_weeks} ${program.duration_weeks === 1 ? 'semana' : 'semanas'}`,
    `${dayCount} ${dayCount === 1 ? 'día' : 'días'}`,
    `${exCount} ejercicios`,
    `Inicio ${fmtDate(program.start_date)}`,
    STATUS_LABEL[program.status] ?? program.status,
  ].join('   ·   ');
  doc.setFontSize(9.5).setTextColor(...MUTED);
  const metaLines = doc.splitTextToSize(meta, contentW) as string[];
  doc.text(metaLines, M, y);
  y += metaLines.length * 13 + 6;

  // Coach notes.
  const notes: [string, string][] = [];
  if (program.progression_rule) notes.push(['Progresión', program.progression_rule]);
  if (program.tempo_default) notes.push(['Tempo', program.tempo_default]);
  if (program.notes) notes.push(['Notas', program.notes]);
  if (notes.length) {
    doc.setFontSize(9);
    for (const [k, v] of notes) {
      const lines = doc.splitTextToSize(`${k}: ${v}`, contentW) as string[];
      doc.setTextColor(...MUTED).text(lines, M, y);
      y += lines.length * 12;
    }
    y += 8;
  }

  // Days, each with its exercise table.
  const days = [...program.program_days].sort((a, b) => a.sort_order - b.sort_order || a.day_index - b.day_index);
  for (const day of days) {
    y = ensureSpace(doc, y, 64, H, M);
    y = dayHeading(doc, day, y, M, contentW);
    const exs = [...day.program_exercises].sort((a, b) => a.sort_order - b.sort_order);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['#', 'Ejercicio', 'Series', 'Reps', 'Desc.', 'Carga', 'RIR · Tempo · Notas']],
      body: exs.map((e, i) => [
        String(i + 1),
        exerciseName(e),
        String(e.sets),
        rangeText(e.rep_min, e.rep_max) + (e.is_unilateral ? ' /lado' : ''),
        e.rest_seconds != null ? `${e.rest_seconds}s` : '—',
        loadText(e),
        detailText(e),
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: INK, lineColor: LINE, lineWidth: 0.5, valign: 'middle' },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', textColor: FAINT },
        1: { cellWidth: 116, fontStyle: 'bold' },
        2: { cellWidth: 36, halign: 'center' },
        3: { cellWidth: 48, halign: 'center' },
        4: { cellWidth: 38, halign: 'center', textColor: MUTED },
        5: { cellWidth: 54, halign: 'center' },
        6: { textColor: MUTED },
      },
    });
    y = afterTable(doc) + 16;
  }

  // Weekly periodization (only if any week carries data).
  const weeks = [...program.program_weeks].sort((a, b) => a.week_number - b.week_number);
  if (weeks.some(weekHasData)) {
    y = ensureSpace(doc, y, 64, H, M);
    y = sectionHeading(doc, 'PERIODIZACIÓN SEMANAL', y, M, contentW);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Sem', 'Etiqueta', 'RIR', '% Carga', 'Series', 'Descarga']],
      body: weeks.map((w) => [
        String(w.week_number),
        w.label ?? '—',
        rangeText(w.rir_min, w.rir_max),
        rangeText(w.load_pct_min, w.load_pct_max) + (w.load_pct_min != null || w.load_pct_max != null ? '%' : ''),
        w.sets_override != null ? String(w.sets_override) : '—',
        w.is_deload ? 'Sí' : '—',
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: INK, lineColor: LINE, lineWidth: 0.5, valign: 'middle' },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 34, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 58, halign: 'center' },
        3: { cellWidth: 66, halign: 'center' },
        4: { cellWidth: 48, halign: 'center' },
        5: { cellWidth: 58, halign: 'center' },
      },
      didParseCell: (data: CellHookData) => {
        if (data.section === 'body' && weeks[data.row.index]?.is_deload) data.cell.styles.fillColor = DELOAD;
      },
    });
    y = afterTable(doc);
  }

  stampFooters(doc, program.name, W, H, M);
  doc.save(`Programa - ${safeFile(clientName)} - ${safeFile(program.name)}.pdf`);
}

function ensureSpace(doc: jsPDF, y: number, need: number, H: number, M: number): number {
  if (y + need > H - M) {
    doc.addPage();
    return M;
  }
  return y;
}

function dayHeading(doc: jsPDF, day: ProgramDay, y: number, M: number, contentW: number): number {
  const h = 20;
  doc.setFillColor(...BAND).roundedRect(M, y, contentW, h, 3, 3, 'F');
  const baseline = y + 13.5;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...BRAND);
  const tag = `DÍA ${day.day_index}`;
  doc.text(tag, M + 8, baseline);
  let x = M + 8 + doc.getTextWidth(tag) + 8;
  if (day.label) {
    doc.setTextColor(...INK).text(day.label, x, baseline);
    x += doc.getTextWidth(day.label) + 8;
  }
  const wd = day.weekday ? WEEKDAY[day.weekday] : null;
  if (wd) {
    doc.setFont('helvetica', 'normal').setTextColor(...MUTED).text(wd, x, baseline);
  }
  return y + h + 4;
}

function sectionHeading(doc: jsPDF, text: string, y: number, M: number, contentW: number): number {
  const h = 20;
  doc.setFillColor(...BAND).roundedRect(M, y, contentW, h, 3, 3, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...INK).text(text, M + 8, y + 13.5);
  return y + h + 4;
}

function stampFooters(doc: jsPDF, programName: string, W: number, H: number, M: number): void {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE).setLineWidth(0.5).line(M, H - 30, W - M, H - 30);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...FAINT);
    doc.text(`The Hokage Coaching · ${programName}`, M, H - 18);
    doc.text(`Página ${i} / ${pages}`, W - M, H - 18, { align: 'right' });
  }
}
