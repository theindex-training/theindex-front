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
}

export type CelebrationKind = 'book' | 'personalBest';

/** A moment worth celebrating (a booking, a personal best), shown once by the holiday layer. */
export interface Celebration {
  id: number;
  /** Translation key of the line shown. */
  key: string;
}

/** The line for each kind of moment, by occasion (Christmas and New Year come later). */
const CELEBRATION_KEYS: Record<CelebrationKind, { december: string }> = {
  book: { december: 'holidays.celebrate.bookDecember' },
  personalBest: { december: 'holidays.celebrate.personalBestDecember' },
};

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

  /** Shows a line (and a burst of snow) for a booking or a personal best while the effects are on. */
  celebrate(kind: CelebrationKind): void {
    if (!this.effects()) {
      return;
    }
    this.celebrationSignal.set({
      id: this.nextCelebration++,
      key: CELEBRATION_KEYS[kind].december,
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
    (stored['doors'] === undefined ||
      (Array.isArray(stored['doors']) &&
        stored['doors'].every((door) => typeof door === 'number')))
  );
}
