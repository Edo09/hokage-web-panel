/** Weight is always stored in kg (DB, mobile app convention). This is a
 *  display-only conversion for the coach's chosen unit — pure functions, no
 *  React, so both the hook and any plain-JS spot (e.g. table cells) can use
 *  them without a component. */
export type WeightUnit = 'kg' | 'lb';

const KG_PER_LB = 0.45359237;

/** kg (storage) -> a number in the given display unit. */
export const kgToDisplay = (kg: number, unit: WeightUnit): number => (unit === 'lb' ? kg / KG_PER_LB : kg);

/** A number in the given display unit -> kg (storage). */
export const displayToKg = (value: number, unit: WeightUnit): number => (unit === 'lb' ? value * KG_PER_LB : value);

/** Formats a stored kg value for display, e.g. "100 kg" / "220.5 lb". */
export function formatWeight(kg: number | null, unit: WeightUnit, dash = '—'): string {
  if (kg == null) return dash;
  const v = Math.round(kgToDisplay(kg, unit) * 10) / 10;
  return `${v} ${unit}`;
}
