import { Subscription } from '../../services/subscriptions.service';
import { dayKeyToDate, localDayKey } from '../../utils/calendar.util';
import { timePassLastDay } from '../../utils/time-pass.util';

/**
 * How soon a trainee needs a new subscription, with the API's thresholds (theindex-api
 * `attendance/attendance-preview.ts`: `LOW_CREDITS`, `LOW_DAYS`):
 * - NONE: no active subscription;
 * - LAST: one training left, or a period that ends today;
 * - LOW: up to 2 trainings or 7 days left;
 * - OK: more than that.
 * With several active subscriptions the one that lasts best decides, since any of them pays.
 */
export type SubscriptionLevel = 'NONE' | 'LAST' | 'LOW' | 'OK';

export const LOW_CREDITS = 2;
export const LOW_DAYS = 7;

export interface SubscriptionSummary {
  level: SubscriptionLevel;
  /** Trainings left on the active punch cards, or null without one. */
  creditsLeft: number | null;
  /** The latest last day of the active time passes (YYYY-MM-DD), or null without one. */
  endsOn: string | null;
  /** Calendar days from today to `endsOn` (0 = today is the last day). */
  daysLeft: number | null;
}

const LEVELS: SubscriptionLevel[] = ['NONE', 'LAST', 'LOW', 'OK'];
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number {
  return Math.round(
    (dayKeyToDate(to).getTime() - dayKeyToDate(from).getTime()) / DAY_MS,
  );
}

function creditsLevel(credits: number): SubscriptionLevel {
  if (credits <= 0) return 'NONE';
  if (credits === 1) return 'LAST';
  return credits <= LOW_CREDITS ? 'LOW' : 'OK';
}

function daysLevel(days: number): SubscriptionLevel {
  if (days < 0) return 'NONE';
  if (days === 0) return 'LAST';
  return days <= LOW_DAYS ? 'LOW' : 'OK';
}

/** The trainee's active subscriptions summed up as of `today` (YYYY-MM-DD). */
export function subscriptionSummary(
  subscriptions: Subscription[],
  today: string,
): SubscriptionSummary {
  const active = subscriptions.filter(
    (s) => s.status.toUpperCase() === 'ACTIVE',
  );
  const punch = active.filter((s) => s.type === 'PUNCH');
  const ends = active
    .filter((s) => s.type === 'TIME' && s.endsAt)
    .map((s) => localDayKey(timePassLastDay(s.endsAt)!))
    .filter((day): day is string => !!day)
    .sort();

  const creditsLeft = punch.length
    ? punch.reduce((sum, s) => sum + (s.remainingCredits ?? 0), 0)
    : null;
  const endsOn = ends.length ? ends[ends.length - 1] : null;
  const daysLeft = endsOn ? daysBetween(today, endsOn) : null;

  const levels = [
    creditsLeft === null ? 'NONE' : creditsLevel(creditsLeft),
    daysLeft === null ? 'NONE' : daysLevel(daysLeft),
  ] as SubscriptionLevel[];
  const level = LEVELS[Math.max(...levels.map((l) => LEVELS.indexOf(l)))];

  return { level, creditsLeft, endsOn, daysLeft };
}
