import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChipComponent } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  Workout,
  WorkoutPart,
  WorkoutVariant,
  WorkoutsService,
} from '../../services/workouts.service';
import { addDays, dayKeyToDate, localDayKey } from '../../utils/calendar.util';
import { itemLine, structurePhrases } from './workout-format';
import { hasSummaryText } from './workout-summary';
import { WorkoutsNavComponent } from './workouts-nav.component';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The Monday of the week a day is in. */
export function mondayOf(day: string): string {
  const weekday = (dayKeyToDate(day).getDay() + 6) % 7;
  return addDays(day, -weekday);
}

interface WeekDay {
  date: string;
  isToday: boolean;
  workouts: Workout[];
}

/**
 * The workouts of one week, Monday to Sunday, a day at a time: each with its type, score and
 * summary (the text people read), and where a day is still empty. `?week=YYYY-MM-DD` (any day of the week) picks the week; without it, this one.
 */
@Component({
  selector: 'app-workouts',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
    WorkoutsNavComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    IconComponent,
    ChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './workouts.component.html',
  styleUrl: './workouts.component.scss',
})
export class WorkoutsComponent implements OnInit {
  weekStart = '';
  days: WeekDay[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly workoutsService: WorkoutsService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    // The page is reused when only `?week=` changes (the sidebar's Workouts link, the back
    // button), so the week follows the address, not just its first value.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const week = params.get('week') ?? '';
        const start = mondayOf(DATE_PATTERN.test(week) ? week : this.today());
        if (start !== this.weekStart) {
          this.weekStart = start;
          this.load();
          // The address changed outside a render: ask for one (the app is zoneless).
          this.changeDetector.markForCheck();
        }
      });
  }

  private today(): string {
    return localDayKey(new Date())!;
  }

  get weekEnd(): string {
    return addDays(this.weekStart, 6);
  }

  get isThisWeek(): boolean {
    return this.weekStart === mondayOf(this.today());
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    const from = this.weekStart;

    this.workoutsService.list({ from, to: this.weekEnd }).subscribe({
      next: (workouts) => {
        if (from !== this.weekStart) {
          return;
        }
        const today = this.today();
        this.days = Array.from({ length: 7 }, (_, offset) => {
          const date = addDays(from, offset);
          return {
            date,
            isToday: date === today,
            workouts: workouts.filter((w) => w.date === date),
          };
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        if (from !== this.weekStart) {
          return;
        }
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /**
   * Moves by whole weeks. The week is shown at once and the address follows, so a reload or a
   * link keeps it (the address change itself then finds the week already shown).
   */
  showWeek(start: string): void {
    this.weekStart = mondayOf(start);
    this.load();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { week: this.isThisWeek ? null : this.weekStart },
      replaceUrl: true,
    });
  }

  previousWeek(): void {
    this.showWeek(addDays(this.weekStart, -7));
  }

  nextWeek(): void {
    this.showWeek(addDays(this.weekStart, 7));
  }

  thisWeek(): void {
    this.showWeek(this.today());
  }

  weekLabel(): string {
    return this.language.t('workouts.list.week', {
      from: this.format.custom(dayKeyToDate(this.weekStart), 'd MMM'),
      to: this.format.custom(dayKeyToDate(this.weekEnd), 'd MMM y'),
    });
  }

  dayLabel(day: string): string {
    return this.format.custom(dayKeyToDate(day), 'EEEE, d MMMM');
  }

  private readonly t = (key: string, params?: Record<string, unknown>) =>
    this.language.t(`workouts.format.${key}`, params);

  /** "3 rounds · cap 15:00": how the level is organised. */
  structure(variant: WorkoutVariant): string {
    return structurePhrases(variant, this.t).join(' · ');
  }

  lines(variant: WorkoutVariant): string[] {
    return variant.items.map((item) => itemLine(item, this.t));
  }

  hasSummary(workout: Workout): boolean {
    return hasSummaryText(workout.summary);
  }

  /** The RX level of the first part: what the page shows when there is no summary. */
  rxOf(workout: Workout): WorkoutVariant | undefined {
    const variants = workout.parts[0]?.variants ?? [];
    return variants.find((v) => v.level === 'RX') ?? variants[0];
  }

  scored(part: WorkoutPart): boolean {
    return part.scoreType !== 'NONE';
  }
}
