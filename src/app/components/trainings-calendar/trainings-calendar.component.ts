import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  Input,
  afterNextRender,
  inject
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { AttendanceTraineeTrainingItem } from '../../services/attendance.service';
import {
  CalendarDay,
  CalendarMonth,
  CalendarWeek,
  addDays,
  addMonths,
  dayKeyToDate,
  inMonth,
  localDayKey,
  monthOf,
  monthWeeks,
  sameMonth
} from '../../utils/calendar.util';
import { displayValue } from '../../utils/display.util';
import { ChipComponent } from '../chip/chip.component';
import { IconComponent } from '../icon/icon.component';
import { SkeletonListComponent } from '../skeleton-list/skeleton-list.component';

type Training = AttendanceTraineeTrainingItem;

/** Trainings shown per day cell on desktop; the rest are summed up as "+N more". */
export const MAX_TRAININGS_PER_CELL = 2;

/** ISO weekday numbers in column order (Monday first). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Month calendar of a trainee's trainings. One row per week (Monday first), one cell per day.
 * Desktop cells list each training (time, trainer, gym); phone cells show a marker per training.
 * Paid trainings use a green dot and unpaid ones a red diamond, explained in a legend. Selecting a
 * day lists its trainings below the grid; with no day selected, phones list the whole month there.
 * The day buttons form one tab stop; arrow keys, Home/End and PageUp/PageDown move between days.
 */
@Component({
  selector: 'app-trainings-calendar',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    EnumLabelPipe,
    UiMessagePipe,
    ChipComponent,
    IconComponent,
    SkeletonListComponent
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './trainings-calendar.component.html',
  styleUrl: './trainings-calendar.component.scss'
})
export class TrainingsCalendarComponent {
  readonly format = inject(LocaleFormatService);
  private readonly language = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  @Input() trainings: Training[] = [];
  @Input() loading = false;
  @Input() errorMessage: UiMessage | null = null;
  /** Translation key of the summary shown when the trainee has no trainings at all. */
  @Input() emptyKey = 'trainings.empty';

  readonly weekdays = WEEKDAYS;
  readonly maxPerCell = MAX_TRAININGS_PER_CELL;
  readonly todayKey = localDayKey(new Date())!;

  month: CalendarMonth = monthOf(new Date());
  weeks: CalendarWeek[] = monthWeeks(this.month);
  /** The day whose trainings are listed below the grid, or null for the whole month. */
  selectedKey: string | null = null;
  /** The day button that takes the grid's single tab stop. */
  focusKey = this.todayKey;

  private indexedTrainings: Training[] | null = null;
  private byDay = new Map<string, Training[]>();

  get isCurrentMonth(): boolean {
    return sameMonth(this.month, monthOf(new Date()));
  }

  get monthTitle(): string {
    return this.format.monthYear(new Date(this.month.year, this.month.month, 1));
  }

  /** Days of the shown month that have trainings, in date order. */
  get monthAgenda(): { day: CalendarDay; trainings: Training[] }[] {
    return this.weeks
      .flat()
      .filter((day): day is CalendarDay => day !== null)
      .map(day => ({ day, trainings: this.trainingsOn(day.key) }))
      .filter(entry => entry.trainings.length > 0);
  }

  get monthTotals(): { count: number; paid: number; unpaid: number } {
    const trainings = this.monthAgenda.flatMap(entry => entry.trainings);
    const unpaid = trainings.filter(training => training.paymentStatus === 'UNPAID').length;
    return { count: trainings.length, paid: trainings.length - unpaid, unpaid };
  }

  get selectedTrainings(): Training[] {
    return this.selectedKey ? this.trainingsOn(this.selectedKey) : [];
  }

  /** Trainings on a local day, earliest first. */
  trainingsOn(key: string): Training[] {
    if (this.indexedTrainings !== this.trainings) {
      this.indexTrainings();
    }
    return this.byDay.get(key) ?? [];
  }

  unpaidCount(trainings: Training[]): number {
    return trainings.filter(training => training.paymentStatus === 'UNPAID').length;
  }

  dayLabel(day: CalendarDay): string {
    const trainings = this.trainingsOn(day.key);
    return this.language.t('trainings.calendar.dayLabel', {
      date: this.format.custom(day.date, 'fullDate'),
      count: trainings.length,
      unpaid: this.unpaidCount(trainings)
    });
  }

  fullDate(key: string): string {
    return this.format.custom(dayKeyToDate(key), 'fullDate');
  }

  trainer(training: Training): string {
    return displayValue(training.trainer.nickname || training.trainer.name);
  }

  location(training: Training): string {
    return displayValue(training.location.name);
  }

  previousMonth(): void {
    this.showMonth(addMonths(this.month, -1));
  }

  nextMonth(): void {
    this.showMonth(addMonths(this.month, 1));
  }

  goToToday(): void {
    this.showMonth(monthOf(new Date()));
  }

  /** Selects a day, or clears the selection when it is already selected. */
  selectDay(key: string): void {
    this.selectedKey = this.selectedKey === key ? null : key;
    this.focusKey = key;
  }

  clearSelection(): void {
    this.selectedKey = null;
  }

  onGridKeydown(event: KeyboardEvent): void {
    const key = this.focusKey;
    const weekdayIndex = (dayKeyToDate(key).getDay() + 6) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(key, -1),
      ArrowRight: () => addDays(key, 1),
      ArrowUp: () => addDays(key, -7),
      ArrowDown: () => addDays(key, 7),
      Home: () => addDays(key, -weekdayIndex),
      End: () => addDays(key, 6 - weekdayIndex),
      PageUp: () => shiftMonth(key, -1),
      PageDown: () => shiftMonth(key, 1)
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }

    event.preventDefault();
    const target = move();
    if (!inMonth(target, this.month)) {
      this.showMonth(monthOf(target));
    }
    this.focusKey = target;
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(`[data-day="${target}"]`)?.focus(),
      { injector: this.injector }
    );
  }

  private showMonth(month: CalendarMonth): void {
    this.setMonth(month);
    this.selectedKey = null;
  }

  private setMonth(month: CalendarMonth): void {
    this.month = month;
    this.weeks = monthWeeks(month);
    this.focusKey = inMonth(this.todayKey, month)
      ? this.todayKey
      : localDayKey(new Date(month.year, month.month, 1))!;
  }

  private indexTrainings(): void {
    const byDay = new Map<string, Training[]>();
    const sorted = [...this.trainings].sort(
      (a, b) => new Date(a.trainedAt).getTime() - new Date(b.trainedAt).getTime()
    );
    for (const training of sorted) {
      const key = localDayKey(training.trainedAt);
      if (key) {
        byDay.set(key, [...(byDay.get(key) ?? []), training]);
      }
    }
    this.byDay = byDay;
    this.indexedTrainings = this.trainings;
  }
}

/** The same day of the month `delta` months away, clamped to that month's last day. */
function shiftMonth(key: string, delta: number): string {
  const date = dayKeyToDate(key);
  const target = addMonths(monthOf(date), delta);
  const lastDay = new Date(target.year, target.month + 1, 0).getDate();
  return localDayKey(new Date(target.year, target.month, Math.min(date.getDate(), lastDay)))!;
}
