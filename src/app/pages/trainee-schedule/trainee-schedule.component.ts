import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChipComponent } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  BookableTraining,
  BookingGym,
  BookingWeek,
  BookingsService,
} from '../../services/bookings.service';
import { addDays, dayKeyToDate, localDayKey } from '../../utils/calendar.util';
import { initialGymId, rememberGym } from '../schedules/schedule-gym';
import { timeRange } from '../schedules/schedule-slot-form.component';
import { mondayOf } from '../workouts/workouts.component';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface TraineeDay {
  date: string;
  title: string;
  isToday: boolean;
  trainings: BookableTraining[];
}

/**
 * A trainee's Schedule (`/schedule`): a gym's week as the staff created it, with Book and Cancel
 * on each training while the rules allow (the API decides: booking closes 30 minutes before a
 * training, cancelling 1 hour before) and how many booked. `?gym=` and `?week=` keep the choice.
 */
@Component({
  selector: 'app-trainee-schedule',
  standalone: true,
  imports: [
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ChipComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './trainee-schedule.component.html',
  styleUrl: './trainee-schedule.component.scss',
})
export class TraineeScheduleComponent implements OnInit {
  gyms: BookingGym[] = [];
  ready = false;
  setupError: UiMessage | null = null;

  gymId = '';
  weekStart = '';
  schedule: BookingWeek | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;

  /** The training whose Book or Cancel is on its way. */
  busyId: string | null = null;
  actionError: UiMessage | null = null;

  readonly range = timeRange;

  constructor(
    private readonly bookings: BookingsService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.loadGyms();
  }

  loadGyms(): void {
    this.setupError = null;
    this.bookings.gyms().subscribe({
      next: (gyms) => {
        this.gyms = gyms;
        this.ready = true;
        this.followAddress();
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.setupError = apiErrorMessage(
          error,
          'traineeSchedule.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** The page is reused when only the query changes, so it follows the address. */
  private followAddress(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const gymId =
          initialGymId(
            this.gyms.map((g) => g.id),
            params.get('gym'),
            this.gyms.find((g) => g.preferred)?.id ?? null,
          ) ?? '';
        const week = params.get('week') ?? '';
        const start = mondayOf(DATE_PATTERN.test(week) ? week : this.today());
        if (gymId !== this.gymId || start !== this.weekStart) {
          this.gymId = gymId;
          this.weekStart = start;
          this.load();
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

  get gymOptions(): SegmentedOption[] {
    return this.gyms.map((g) => ({ value: g.id, label: g.name }));
  }

  /** Loads the week; `keepError` keeps a failed booking's message above it. */
  load(keepError = false): void {
    if (!this.gymId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.errorMessage = null;
    if (!keepError) {
      this.actionError = null;
    }
    const gymId = this.gymId;
    const start = this.weekStart;
    this.bookings.week(gymId, start).subscribe({
      next: (schedule) => {
        if (gymId !== this.gymId || start !== this.weekStart) {
          return;
        }
        this.schedule = schedule;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        if (gymId !== this.gymId || start !== this.weekStart) {
          return;
        }
        this.errorMessage = apiErrorMessage(
          error,
          'traineeSchedule.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  private navigate(gymId: string, start: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        gym: gymId,
        week: start === mondayOf(this.today()) ? null : start,
      },
      replaceUrl: true,
    });
  }

  selectGym(gymId: string): void {
    rememberGym(gymId);
    this.navigate(gymId, this.weekStart);
  }

  previousWeek(): void {
    this.navigate(this.gymId, addDays(this.weekStart, -7));
  }

  nextWeek(): void {
    this.navigate(this.gymId, addDays(this.weekStart, 7));
  }

  thisWeek(): void {
    this.navigate(this.gymId, mondayOf(this.today()));
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

  get days(): TraineeDay[] {
    const schedule = this.schedule;
    if (!schedule) {
      return [];
    }
    const today = this.today();
    return Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(schedule.weekStart, offset);
      return {
        date,
        title: this.dayLabel(date),
        isToday: date === today,
        trainings: schedule.slots.filter((s) => s.date === date),
      };
    });
  }

  /** Names a training for buttons and the confirm: "Friday, 13 November 18:00 – 19:00". */
  describe(training: BookableTraining): string {
    return `${this.dayLabel(training.date)} ${timeRange(training.trainingTime)}`;
  }

  /** A training that has started: no actions and no "closed" note any more. */
  isPast(training: BookableTraining): boolean {
    return new Date(training.startsAt).getTime() <= Date.now();
  }

  book(training: BookableTraining): void {
    this.act(
      training,
      this.bookings.book(training.id),
      'traineeSchedule.bookError',
    );
  }

  cancel(training: BookableTraining): void {
    const question = this.language.t('traineeSchedule.confirmCancel', {
      training: this.describe(training),
    });
    if (!window.confirm(question)) {
      return;
    }
    this.act(
      training,
      this.bookings.cancel(training.id),
      'traineeSchedule.cancelError',
    );
  }

  private act(
    training: BookableTraining,
    request: ReturnType<BookingsService['book']>,
    fallbackKey: string,
  ): void {
    this.busyId = training.id;
    this.actionError = null;
    request.subscribe({
      next: (updated) => {
        this.busyId = null;
        if (this.schedule) {
          this.schedule = {
            ...this.schedule,
            slots: this.schedule.slots.map((s) =>
              s.id === updated.id ? updated : s,
            ),
          };
        }
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.busyId = null;
        this.actionError = apiErrorMessage(error, fallbackKey);
        // The training may have changed meanwhile (closed, cancelled elsewhere): show it as it is.
        this.load(true);
      },
    });
  }
}
