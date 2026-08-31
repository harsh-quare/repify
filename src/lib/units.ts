import type { UnitPreference } from '@/lib/types';

// The DB stores kg (and cm) canonically; conversion happens only at the UI edge.
const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function weightUnitLabel(unit: UnitPreference): 'kg' | 'lbs' {
  return unit === 'imperial' ? 'lbs' : 'kg';
}

/** kg → display number in the user's unit, rounded to 1 decimal. */
export function toDisplayWeight(kg: number, unit: UnitPreference): number {
  const value = unit === 'imperial' ? kg / KG_PER_LB : kg;
  return Math.round(value * 10) / 10;
}

/** User-entered number in their unit → kg, rounded to 2 decimals (DB is numeric(6,2)). */
export function fromDisplayWeight(value: number, unit: UnitPreference): number {
  const kg = unit === 'imperial' ? value * KG_PER_LB : value;
  return Math.round(kg * 100) / 100;
}

/** kg → "132.5" in the user's unit (no unit suffix). */
export function formatWeight(kg: number, unit: UnitPreference): string {
  const n = toDisplayWeight(kg, unit);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** kg → "132.5 lbs" / "60 kg". */
export function formatWeightWithUnit(kg: number, unit: UnitPreference): string {
  return `${formatWeight(kg, unit)} ${weightUnitLabel(unit)}`;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cm / CM_PER_IN;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_IN * 10) / 10;
}

/** BMI from canonical units; null when inputs are unusable. */
export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
