import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  HolidayState,
  holidayState,
  parseDayKey,
  sofiaDayKey,
} from './holiday-calendar';
import { HOLIDAY_CLOCK } from './holiday-clock.token';

/**
 * Everything the holidays keep in the browser, under one key for the season: whether the effects
 * are off and which Advent doors were opened. It is deleted on the first visit outside Dec 1 –
 * Jan 10, and a value from an earlier season is never read, so nothing is kept past the holidays
 * and next December starts fresh (effects on, every door closed).
 */
export const HOLIDAY_STORAGE_KEY = 'holidays';

interface StoredHolidays {
  season: number;
  /** Present (false) only when the person switched the effects off. */
  effects?: false;
  /** The Advent doors opened, by day. */
  doors?: number[];
  /** The days (of December) whose hidden gift was found. */
  gifts?: number[];
}

export type CelebrationKind = 'book' | 'personalBest';

/** How a celebration bursts: a puff of snow (December) or confetti (Christmas). */
export type BurstStyle = 'snow' | 'confetti';

/** A moment worth celebrating, shown once by the holiday layer. */
export interface Celebration {
  id: number;
  /** Translation key of the line shown; none when the moment shows its own text (a gift). */
  key: string | null;
  burst: BurstStyle;
  /** Where the burst starts (window coordinates); the bottom middle when left out. */
  origin?: { x: number; y: number };
}

type Occasion = 'december' | 'christmas';

/** The line for each kind of moment, by occasion (New Year comes later). */
const CELEBRATION_KEYS: Record<CelebrationKind, Record<Occasion, string>> = {
  book: {
    december: 'holidays.celebrate.bookDecember',
    christmas: 'holidays.celebrate.bookChristmas',
  },
  personalBest: {
    december: 'holidays.celebrate.personalBestDecember',
    christmas: 'holidays.celebrate.personalBestChristmas',
  },
};

/**
 * Where the day's hidden gift is (Dec 20 – 27, in that order): a page every person of the role
 * can open, matched by its path. The gift sits by the page's title (`app-page-header`).
 */
export const GIFT_PAGES: Record<'TRAINEE' | 'STAFF', readonly string[]> = {
  TRAINEE: [
    '/home',
    '/schedule',
    '/records',
    '/exercises',
    '/stats',
    '/home',
    '/records',
    '/schedule',
  ],
  STAFF: [
    '/home',
    '/workouts/schedule',
    '/records',
    '/workouts',
    '/workouts/exercises',
    '/home',
    '/records',
    '/workouts/benchmarks',
  ],
};

/** The first day with a hidden gift (Dec 20, as Christmas starts). */
const FIRST_GIFT_DAY = 20;

/** How often "today" is read again, so the occasions change at midnight in an open tab. */
const CLOCK_INTERVAL = 60_000;

/**
 * The holidays (December, Christmas, New Year) by the gym's calendar day: what is on
 * (`state`), whether the person wants the effects (`effectsOn`), the Advent doors they opened and
 * the celebrations to show. `?holidayDate=YYYY-MM-DD` in the address the app is opened with
 * previews that day for the rest of the visit, and stores nothing.
 */
@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly document = inject(DOCUMENT);
  private readonly clock = inject(HOLIDAY_CLOCK);

  /** The day being previewed (`?holidayDate=`), or null for today. */
  readonly previewDay = parseDayKey(
    new URLSearchParams(this.document.defaultView?.location.search ?? '').get(
      'holidayDate',
    ),
  );

  private readonly now = signal(this.clock());

  /** The gym's calendar day, 'YYYY-MM-DD'. */
  readonly day = computed(() => this.previewDay ?? sofiaDayKey(this.now()));
  readonly state = computed<HolidayState>(() => holidayState(this.day()));

  private readonly stored = signal<StoredHolidays | null>(null);

  /** The person's choice in the navigation (on unless they switched it off this season). */
  readonly effectsOn = computed(() => this.stored()?.effects !== false);
  /** Snowfall, snow caps and celebrations: December and the effects on. */
  readonly effects = computed(() => this.state().december && this.effectsOn());
  readonly openedDoors = computed<readonly number[]>(
    () => this.stored()?.doors ?? [],
  );
  /** The Christmas decorations (the hat on the logo, the lights): Christmas and the effects on. */
  readonly christmas = computed(
    () => this.state().christmas && this.effectsOn(),
  );
  /** How hard it snows: harder over Christmas. */
  readonly snowIntensity = computed(() => (this.state().christmas ? 1 : 0.6));
  /** Today's day of December while a gift hides somewhere (Dec 20 – 27, effects on), else null. */
  readonly giftDay = computed(() => {
    if (!this.christmas()) {
      return null;
    }
    return Number(this.day().slice(8, 10));
  });
  /** Whether today's gift was found already. */
  readonly giftFound = computed(() => {
    const day = this.giftDay();
    return day !== null && (this.stored()?.gifts ?? []).includes(day);
  });

  private readonly reducedMotionQuery = this.document.defaultView?.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  );
  /** The OS asks for less motion: no falling snow or bursts; the caps and texts stay. */
  readonly reducedMotion = signal(this.reducedMotionQuery?.matches ?? false);

  private readonly celebrationSignal = signal<Celebration | null>(null);
  readonly celebration = this.celebrationSignal.asReadonly();
  private nextCelebration = 1;

  constructor() {
    this.sync(this.state());
    effect(() => this.sync(this.state()));

    const view = this.document.defaultView;
    const timer = view?.setInterval(
      () => this.now.set(this.clock()),
      CLOCK_INTERVAL,
    );
    const onMotion = (event: MediaQueryListEvent) =>
      this.reducedMotion.set(event.matches);
    this.reducedMotionQuery?.addEventListener?.('change', onMotion);
    inject(DestroyRef).onDestroy(() => {
      view?.clearInterval(timer);
      this.reducedMotionQuery?.removeEventListener?.('change', onMotion);
    });

    // The snow caps on the page titles are CSS (page-header), switched on from <html>.
    effect(() => {
      const root = this.document.documentElement;
      const snow = this.effects();
      root.toggleAttribute('data-holiday-snow', snow);
      if (snow) {
        root.style.setProperty(
          '--holiday-snow-depth',
          this.state().snowDepth.toFixed(3),
        );
      } else {
        root.style.removeProperty('--holiday-snow-depth');
      }
    });
  }

  setEffects(on: boolean): void {
    const current = this.stored();
    if (!current) {
      return;
    }
    const next: StoredHolidays = { ...current };
    if (on) {
      delete next.effects;
    } else {
      next.effects = false;
    }
    this.write(next);
  }

  /** Whether the door can be opened today (it never locks again once its day has come). */
  canOpenDoor(day: number): boolean {
    const state = this.state();
    return state.advent && day >= 1 && day <= state.adventDay;
  }

  /** Remembers an opened door; false when it can't be opened yet. */
  openDoor(day: number): boolean {
    const current = this.stored();
    if (!current || !this.canOpenDoor(day)) {
      return false;
    }
    const doors = current.doors ?? [];
    if (!doors.includes(day)) {
      this.write({ ...current, doors: [...doors, day] });
    }
    return true;
  }

  /**
   * Shows a line for a booking or a personal best while the effects are on, with a puff of snow
   * (confetti over Christmas).
   */
  celebrate(kind: CelebrationKind): void {
    if (!this.effects()) {
      return;
    }
    const occasion: Occasion = this.state().christmas
      ? 'christmas'
      : 'december';
    this.celebrationSignal.set({
      id: this.nextCelebration++,
      key: CELEBRATION_KEYS[kind][occasion],
      burst: occasion === 'christmas' ? 'confetti' : 'snow',
    });
  }

  /** The page (path) where today's gift hides for this role, or null when there is none. */
  giftPage(role: string | null): string | null {
    const day = this.giftDay();
    if (day === null || !role || this.giftFound()) {
      return null;
    }
    const pages = GIFT_PAGES[role === 'TRAINEE' ? 'TRAINEE' : 'STAFF'];
    return pages[day - FIRST_GIFT_DAY] ?? null;
  }

  /** Opens today's gift: remembered, with confetti from where it was. */
  openGift(origin: { x: number; y: number }): void {
    const day = this.giftDay();
    const current = this.stored();
    if (day === null || !current) {
      return;
    }
    const gifts = current.gifts ?? [];
    if (!gifts.includes(day)) {
      this.write({ ...current, gifts: [...gifts, day] });
    }
    this.celebrationSignal.set({
      id: this.nextCelebration++,
      key: null,
      burst: 'confetti',
      origin,
    });
  }

  /** Keeps the stored value in step with the season: deleted outside it, reset for a new one. */
  private sync(state: HolidayState): void {
    if (state.season === null) {
      this.stored.set(null);
      this.remove();
      return;
    }
    if (this.stored()?.season === state.season) {
      return;
    }
    const kept = this.read();
    if (kept?.season === state.season) {
      this.stored.set(kept);
    } else {
      this.stored.set({ season: state.season });
      this.remove();
    }
  }

  private read(): StoredHolidays | null {
    if (this.previewDay) {
      return null;
    }
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(HOLIDAY_STORAGE_KEY) ?? 'null',
      );
      return isStored(value) ? value : null;
    } catch {
      return null;
    }
  }

  private write(value: StoredHolidays): void {
    this.stored.set(value);
    if (this.previewDay) {
      return;
    }
    try {
      localStorage.setItem(HOLIDAY_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this visit.
    }
  }

  private remove(): void {
    if (this.previewDay) {
      return;
    }
    try {
      localStorage.removeItem(HOLIDAY_STORAGE_KEY);
    } catch {
      // Nothing to delete when storage is unavailable.
    }
  }
}

function isStored(value: unknown): value is StoredHolidays {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const stored = value as Record<string, unknown>;
  return (
    typeof stored['season'] === 'number' &&
    isDayList(stored['doors']) &&
    isDayList(stored['gifts'])
  );
}

function isDayList(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((day) => typeof day === 'number'))
  );
}
