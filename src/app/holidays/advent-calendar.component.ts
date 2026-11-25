import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../components/icon/icon.component';
import { LanguageService } from '../i18n/language.service';
import { LocaleFormatService } from '../i18n/locale-format.service';
import { AuthService } from '../services/auth.service';
import {
  ADVENT_DOORS,
  ADVENT_KIND_ICONS,
  ADVENT_KIND_LABELS,
  ADVENT_ORDER,
  AdventDoor,
  AdventDoorAction,
} from './advent-doors';
import { HolidayService } from './holiday.service';

/** How long a door takes to swing open before what is behind it shows (specs use 0). */
export const ADVENT_OPEN_DELAY = new InjectionToken<number>(
  'ADVENT_OPEN_DELAY',
  { providedIn: 'root', factory: () => 450 },
);

/**
 * The Advent calendar on everyone's dashboard, Dec 1 – Dec 31: 24 doors in a mixed-up order.
 * Today's door stands out; doors whose day has come open (missed ones too), later ones say when
 * they open. Opening one swings it open and shows what is behind it in a dialog; opened doors are
 * remembered on the device until the holidays end (HolidayService).
 */
@Component({
  selector: 'app-advent-calendar',
  standalone: true,
  imports: [TranslocoPipe, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './advent-calendar.component.html',
  styleUrl: './advent-calendar.component.scss',
})
export class AdventCalendarComponent {
  readonly holidays = inject(HolidayService);
  private readonly language = inject(LanguageService);
  private readonly format = inject(LocaleFormatService);
  private readonly role = inject(AuthService).getUserRole();
  private readonly openDelay = inject(ADVENT_OPEN_DELAY);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly doors: AdventDoor[] = ADVENT_ORDER.map(
    (day) => ADVENT_DOORS[day - 1],
  );
  readonly kindLabels = ADVENT_KIND_LABELS;
  readonly kindIcons = ADVENT_KIND_ICONS;

  /** The door whose content the dialog shows. */
  readonly shown = signal<AdventDoor | null>(null);
  /** A later door that was tapped: the calendar says when it opens. */
  readonly lockedTapped = signal<number | null>(null);

  /** Today's day of December while there is a door for it (1–24), else null. */
  readonly today = computed(() => {
    const [, month, day] = this.holidays.day().split('-').map(Number);
    return month === 12 && day <= 24 ? day : null;
  });

  readonly openedCount = computed(
    () =>
      this.holidays
        .openedDoors()
        .filter((day) => day <= this.holidays.state().adventDay).length,
  );

  isOpen(door: AdventDoor): boolean {
    return this.holidays.openedDoors().includes(door.day);
  }

  isLocked(door: AdventDoor): boolean {
    return !this.holidays.canOpenDoor(door.day);
  }

  /** "5 December", in the page's language. */
  dayLabel(day: number): string {
    this.language.lang();
    const season = this.holidays.state().season ?? new Date().getFullYear();
    return this.format.custom(new Date(season, 11, day), 'd MMMM');
  }

  doorLabel(door: AdventDoor): string {
    const day = this.dayLabel(door.day);
    if (this.isLocked(door)) {
      return this.language.t('holidays.advent.locked', { day });
    }
    return this.language.t(
      this.isOpen(door)
        ? 'holidays.advent.doorOpened'
        : door.day === this.today()
          ? 'holidays.advent.doorToday'
          : 'holidays.advent.door',
      { day },
    );
  }

  /** The door's link, when the signed-in role can open its page. */
  action(door: AdventDoor): AdventDoorAction | null {
    return door.action && this.role && door.action.roles.includes(this.role)
      ? door.action
      : null;
  }

  open(door: AdventDoor): void {
    if (this.isLocked(door)) {
      this.lockedTapped.set(door.day);
      return;
    }
    this.lockedTapped.set(null);
    const firstTime = !this.isOpen(door);
    this.holidays.openDoor(door.day);
    this.shown.set(door);
    if (firstTime && this.openDelay && !this.holidays.reducedMotion()) {
      setTimeout(() => this.showDialog(), this.openDelay);
    } else {
      this.showDialog();
    }
  }

  close(): void {
    this.dialog()?.nativeElement.close();
  }

  /** A click on the backdrop (the dialog element itself) closes it. */
  handleDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }

  private showDialog(): void {
    const dialog = this.dialog()?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }
}
