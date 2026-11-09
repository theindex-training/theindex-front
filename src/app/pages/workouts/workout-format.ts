import {
  WorkoutItem,
  WorkoutVariant,
  WorkoutVariantFields,
} from '../../services/workouts.service';
import { formatClock } from './workout-form';

/** Translates one of the workout format texts (rounds, every, cap, kg...). */
export type Translate = (
  key: string,
  params?: Record<string, unknown>,
) => string;

type ItemText = Omit<WorkoutItem, 'exerciseId' | 'exercise'>;

/**
 * How a level is organised, as short phrases: "3 rounds", "21-15-9", "12:00", "every 1:00",
 * "cap 15:00". Shown after the type's name, so it works for any type.
 */
export function structurePhrases(
  variant: WorkoutVariantFields,
  t: Translate,
): string[] {
  const phrases: string[] = [];
  if (variant.rounds !== null) {
    phrases.push(t('rounds', { count: variant.rounds }));
  }
  if (variant.repScheme?.length) {
    phrases.push(variant.repScheme.join('-'));
  }
  if (variant.durationSeconds !== null) {
    phrases.push(formatClock(variant.durationSeconds));
  }
  if (variant.intervalSeconds !== null) {
    phrases.push(t('every', { time: formatClock(variant.intervalSeconds) }));
  }
  if (variant.workSeconds !== null) {
    phrases.push(t('work', { time: formatClock(variant.workSeconds) }));
  }
  if (variant.restSeconds !== null) {
    phrases.push(t('rest', { time: formatClock(variant.restSeconds) }));
  }
  if (variant.timeCapSeconds !== null) {
    phrases.push(t('cap', { time: formatClock(variant.timeCapSeconds) }));
  }
  return phrases;
}

/** "400 m", "21", "10–15", "0:40", "20/15 cal (M/W)", "max", "max in 0:40"; empty for scheme reps. */
export function amountText(item: ItemText, t: Translate): string {
  const one = (value: number) =>
    item.measure === 'TIME' ? formatClock(value) : String(value);
  const unit =
    item.measure === 'DISTANCE'
      ? t('metres')
      : item.measure === 'CALORIES'
        ? t('calories')
        : '';
  const withUnit = (text: string) => (unit ? `${text} ${unit}` : text);

  if (item.quantity === null) {
    return item.maxEffort ? t('max') : '';
  }
  let amount = one(item.quantity);
  if (item.quantityMax !== null) {
    amount = `${amount}–${one(item.quantityMax)}`;
  }
  const text =
    item.quantityFemale !== null
      ? t('gendered', {
          male: amount,
          female: one(item.quantityFemale),
          unit,
        }).replace(/\s+/g, ' ')
      : withUnit(amount);
  if (!item.maxEffort) {
    return text;
  }
  return item.measure === 'TIME'
    ? t('maxIn', { time: text })
    : t('maxOf', { amount: text });
}

/** "24 kg", "24/16 kg (M/W)", "80%", "80% · 60 kg"; empty without a load. */
export function loadText(item: ItemText, t: Translate): string {
  const parts: string[] = [];
  if (item.loadPercent !== null) {
    parts.push(`${item.loadPercent}%`);
  }
  if (item.loadKg !== null) {
    parts.push(
      item.loadFemaleKg !== null
        ? t('gendered', {
            male: String(item.loadKg),
            female: String(item.loadFemaleKg),
            unit: t('kg'),
          })
        : `${item.loadKg} ${t('kg')}`,
    );
  }
  return parts.join(' · ');
}

/** One line for an item: "400 m Run", "21 Kettlebell swing · 24/16 kg (M/W)", "Min 2: 0:40 Sit-up". */
export function itemLine(item: WorkoutItem, t: Translate): string {
  const amount = amountText(item, t);
  let line = amount ? `${amount} ${item.exercise.name}` : item.exercise.name;
  if (item.slot !== null) {
    line = `${t('slot', { slot: item.slot })}: ${line}`;
  }
  const load = loadText(item, t);
  if (load) {
    line += ` · ${load}`;
  }
  if (item.notes) {
    line += ` (${item.notes})`;
  }
  return line;
}

export function variantLines(variant: WorkoutVariant, t: Translate): string[] {
  return variant.items.map((item) => itemLine(item, t));
}
