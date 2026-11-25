import { IconName } from '../components/icon/icon.component';

export type AdventDoorKind =
  'joke' | 'tip' | 'challenge' | 'feature' | 'holiday';

/** A link behind a door, for the roles that can open the page. */
export interface AdventDoorAction {
  route: string;
  label: string;
  roles: readonly string[];
}

export interface AdventDoor {
  /** 1–24 (December). */
  day: number;
  kind: AdventDoorKind;
  /** Translation key of what is behind the door. */
  text: string;
  action?: AdventDoorAction;
}

const BOOK: AdventDoorAction = {
  route: '/schedule',
  label: 'holidays.advent.actions.book',
  roles: ['TRAINEE'],
};

/**
 * What is behind each door (`holidays.advent.doors.*` in both language files): jokes, coaches'
 * tips, small challenges, "Did you know?" doors that show what the app can do, and the Bulgarian
 * days of December (Nikulden on the 6th, Students' Day on the 8th, the solstice, Christmas Eve).
 */
export const ADVENT_DOORS: readonly AdventDoor[] = [
  { day: 1, kind: 'holiday', text: 'holidays.advent.doors.d1' },
  {
    day: 2,
    kind: 'feature',
    text: 'holidays.advent.doors.d2',
    action: BOOK,
  },
  { day: 3, kind: 'joke', text: 'holidays.advent.doors.d3' },
  { day: 4, kind: 'tip', text: 'holidays.advent.doors.d4' },
  { day: 5, kind: 'challenge', text: 'holidays.advent.doors.d5' },
  { day: 6, kind: 'holiday', text: 'holidays.advent.doors.d6' },
  {
    day: 7,
    kind: 'feature',
    text: 'holidays.advent.doors.d7',
    action: {
      route: '/records',
      label: 'holidays.advent.actions.records',
      roles: ['TRAINEE', 'TRAINER', 'ADMIN'],
    },
  },
  { day: 8, kind: 'holiday', text: 'holidays.advent.doors.d8' },
  { day: 9, kind: 'tip', text: 'holidays.advent.doors.d9' },
  { day: 10, kind: 'challenge', text: 'holidays.advent.doors.d10' },
  { day: 11, kind: 'feature', text: 'holidays.advent.doors.d11' },
  { day: 12, kind: 'joke', text: 'holidays.advent.doors.d12' },
  { day: 13, kind: 'tip', text: 'holidays.advent.doors.d13' },
  { day: 14, kind: 'challenge', text: 'holidays.advent.doors.d14' },
  { day: 15, kind: 'joke', text: 'holidays.advent.doors.d15' },
  { day: 16, kind: 'feature', text: 'holidays.advent.doors.d16' },
  { day: 17, kind: 'joke', text: 'holidays.advent.doors.d17' },
  { day: 18, kind: 'tip', text: 'holidays.advent.doors.d18' },
  { day: 19, kind: 'challenge', text: 'holidays.advent.doors.d19' },
  { day: 20, kind: 'joke', text: 'holidays.advent.doors.d20' },
  { day: 21, kind: 'holiday', text: 'holidays.advent.doors.d21' },
  { day: 22, kind: 'challenge', text: 'holidays.advent.doors.d22' },
  {
    day: 23,
    kind: 'feature',
    text: 'holidays.advent.doors.d23',
    action: {
      route: '/schedule',
      label: 'holidays.advent.actions.schedule',
      roles: ['TRAINEE'],
    },
  },
  {
    day: 24,
    kind: 'holiday',
    text: 'holidays.advent.doors.d24',
    action: BOOK,
  },
];

/** The order the doors sit in, mixed up like a real Advent calendar (24, the big one, last). */
export const ADVENT_ORDER: readonly number[] = [
  13, 7, 22, 2, 18, 10, 5, 16, 1, 20, 11, 8, 3, 15, 23, 6, 19, 12, 4, 21, 9, 17,
  14, 24,
];

export const ADVENT_KIND_LABELS: Record<AdventDoorKind, string> = {
  joke: 'holidays.advent.kinds.joke',
  tip: 'holidays.advent.kinds.tip',
  challenge: 'holidays.advent.kinds.challenge',
  feature: 'holidays.advent.kinds.feature',
  holiday: 'holidays.advent.kinds.holiday',
};

export const ADVENT_KIND_ICONS: Record<AdventDoorKind, IconName> = {
  joke: 'smile',
  tip: 'lightbulb',
  challenge: 'dumbbell',
  feature: 'info',
  holiday: 'star',
};
