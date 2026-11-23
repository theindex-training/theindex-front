import { Plan } from '../../services/plans.service';

/**
 * How a TIME plan's duration is counted (theindex-api `durationDays` /
 * `durationMonths`, exactly one of them). Months are calendar months: a pass
 * from Apr 14 lasts until May 14, when the next one starts.
 */
export type DurationUnit = 'MONTHS' | 'DAYS';

/** New TIME plans are counted in months: the gym's passes follow the calendar. */
export const DEFAULT_DURATION_UNIT: DurationUnit = 'MONTHS';

/** A plan's duration as the form shows it: an amount and its unit. */
export function durationOf(
  plan: Pick<Plan, 'durationDays' | 'durationMonths'>,
): { duration: number | null; unit: DurationUnit } {
  if (plan.durationMonths) {
    return { duration: plan.durationMonths, unit: 'MONTHS' };
  }
  if (plan.durationDays) {
    return { duration: plan.durationDays, unit: 'DAYS' };
  }
  return { duration: null, unit: DEFAULT_DURATION_UNIT };
}

/** The API's two duration fields for an amount in a unit (the other one null). */
export function durationFields(
  unit: DurationUnit,
  duration: number,
): { durationDays: number | null; durationMonths: number | null } {
  return unit === 'MONTHS'
    ? { durationDays: null, durationMonths: duration }
    : { durationDays: duration, durationMonths: null };
}

/** What a plan includes, as a translation key and its count ("12 credits", "1 month", "30 days"). */
export function planIncludes(
  plan: Pick<Plan, 'type' | 'credits' | 'durationDays' | 'durationMonths'>,
): { key: string; count: number } {
  if (plan.type === 'PUNCH') {
    return { key: 'plans.fields.creditsCount', count: plan.credits ?? 0 };
  }
  if (plan.durationMonths) {
    return { key: 'plans.fields.monthsCount', count: plan.durationMonths };
  }
  return { key: 'plans.fields.daysCount', count: plan.durationDays ?? 0 };
}
