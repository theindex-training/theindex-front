import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ChipComponent } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { TraineeSubscriptionsTableComponent } from '../../components/trainee-subscriptions-table/trainee-subscriptions-table.component';
import { TraineeTrainingsComponent } from '../../components/trainee-trainings/trainee-trainings.component';
import {
  AttendanceService,
  AttendanceTraineeTrainingItem,
} from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import {
  BookingGym,
  BookingsService,
  GymTraining,
} from '../../services/bookings.service';
import { Plan, PlansService } from '../../services/plans.service';
import {
  Subscription,
  SubscriptionsService,
} from '../../services/subscriptions.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { addDays, dayKeyToDate, localDayKey } from '../../utils/calendar.util';
import { initialGymId, rememberGym } from '../schedules/schedule-gym';
import { timeRange } from '../schedules/schedule-slot-form.component';
import {
  SubscriptionLevel,
  SubscriptionSummary,
  subscriptionSummary,
} from './subscription-summary';

type SubscriptionFilter = 'ACTIVE' | 'EXHAUSTED' | 'ALL';

interface UpcomingDay {
  date: string;
  label:
    'traineeDashboard.upcoming.today' | 'traineeDashboard.upcoming.tomorrow';
  trainings: GymTraining[];
}

/**
 * The trainee's dashboard (`/home`, once "My profile"): how much is left of their subscription
 * and when to renew, today's and tomorrow's trainings at their gym (their own bookings in any gym)
 * to book or cancel under the Schedule's rules, then their subscriptions and attendance.
 */
@Component({
  selector: 'app-trainee-dashboard',
  standalone: true,
  imports: [
    UiMessagePipe,
    TranslocoPipe,
    CommonModule,
    RouterLink,
    ChipComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
    TraineeSubscriptionsTableComponent,
    TraineeTrainingsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './trainee-dashboard.component.html',
  styleUrls: [
    '../home/dashboard-trainings.scss',
    './trainee-dashboard.component.scss',
  ],
})
export class TraineeDashboardComponent implements OnInit {
  private readonly bookings = inject(BookingsService);
  private readonly language = inject(LanguageService);
  private readonly format = inject(LocaleFormatService);
  private readonly router = inject(Router);

  subscriptionFilter: SubscriptionFilter = 'ACTIVE';
  readonly subscriptionFilterOptions: SegmentedOption<SubscriptionFilter>[] = [
    { value: 'ACTIVE', label: 'subscriptions.filter.active' },
    { value: 'EXHAUSTED', label: 'subscriptions.filter.exhausted' },
    { value: 'ALL', label: 'common.all' },
  ];

  loading = true;
  errorMessage: UiMessage | null = null;

  subscriptions: Subscription[] = [];
  subscriptionsLoading = true;
  subscriptionErrorMessage: UiMessage | null = null;

  trainings: AttendanceTraineeTrainingItem[] = [];
  trainingsLoading = true;
  trainingErrorMessage: UiMessage | null = null;

  plans: Plan[] = [];

  readonly today = localDayKey(new Date())!;
  readonly tomorrow = addDays(this.today, 1);
  readonly range = timeRange;
  gyms: BookingGym[] = [];
  gymId = '';
  upcoming: GymTraining[] = [];
  upcomingLoading = true;
  upcomingError: UiMessage | null = null;
  /** The training whose Book or Cancel is on its way. */
  busyId: string | null = null;
  actionError: UiMessage | null = null;

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: PlansService,
    private readonly authService: AuthService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadUpcoming();
  }

  get filteredSubscriptions(): Subscription[] {
    if (this.subscriptionFilter === 'ALL') {
      return this.subscriptions;
    }

    return this.subscriptions.filter(
      (subscription) =>
        subscription.status.toUpperCase() === this.subscriptionFilter,
    );
  }

  get filteredSubscriptionsEmptyKey(): string {
    if (this.subscriptionFilter === 'ACTIVE') {
      return 'traineeDashboard.noActiveSubscriptions';
    }

    if (this.subscriptionFilter === 'EXHAUSTED') {
      return 'traineeDashboard.noExhaustedSubscriptions';
    }

    return 'traineeDashboard.noSubscriptions';
  }

  /** What to do, by how soon a new subscription is needed. */
  readonly adviceKeys: Record<SubscriptionLevel, string> = {
    NONE: 'traineeDashboard.summary.advice.NONE',
    LAST: 'traineeDashboard.summary.advice.LAST',
    LOW: 'traineeDashboard.summary.advice.LOW',
    OK: 'traineeDashboard.summary.advice.OK',
  };

  get summary(): SubscriptionSummary {
    return subscriptionSummary(this.subscriptions, this.today);
  }

  formatDate(day: string): string {
    return this.format.date(dayKeyToDate(day));
  }

  // ---- today's and tomorrow's trainings ----

  get gymOptions(): SegmentedOption[] {
    return this.gyms.map((g) => ({ value: g.id, label: g.name }));
  }

  /** The chosen gym's trainings, and the trainee's own bookings in the other gyms. */
  get upcomingDays(): UpcomingDay[] {
    const shown = this.upcoming.filter(
      (t) => t.gym.id === this.gymId || t.bookedByMe,
    );
    return [
      { date: this.today, label: 'traineeDashboard.upcoming.today' as const },
      {
        date: this.tomorrow,
        label: 'traineeDashboard.upcoming.tomorrow' as const,
      },
    ].map((day) => ({
      ...day,
      trainings: shown.filter((t) => t.date === day.date),
    }));
  }

  /**
   * The trainee's own bookings of today and tomorrow, in any gym, until each training ends: the
   * "Your bookings" section above the trainings, so a booking made for later today stands out.
   */
  get myBookings(): (GymTraining & { day: UpcomingDay['label'] })[] {
    const now = Date.now();
    return this.upcoming
      .filter((t) => t.bookedByMe && trainingEndsAt(t) > now)
      .map((t) => ({
        ...t,
        day:
          t.date === this.today
            ? ('traineeDashboard.upcoming.today' as const)
            : ('traineeDashboard.upcoming.tomorrow' as const),
      }));
  }

  selectGym(gymId: string): void {
    this.gymId = gymId;
    rememberGym(gymId);
  }

  loadUpcoming(keepError = false): void {
    this.upcomingLoading = true;
    this.upcomingError = null;
    if (!keepError) {
      this.actionError = null;
    }
    forkJoin({
      gyms: this.bookings.gyms(),
      trainings: this.bookings.trainings(this.today, this.tomorrow),
    }).subscribe({
      next: ({ gyms, trainings }) => {
        this.gyms = gyms;
        this.gymId =
          initialGymId(
            gyms.map((g) => g.id),
            this.gymId || null,
            gyms.find((g) => g.preferred)?.id ?? null,
          ) ?? '';
        this.upcoming = trainings.slots;
        this.upcomingLoading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.upcomingError = apiErrorMessage(
          error,
          'traineeDashboard.upcoming.loadErrorMessage',
        );
        this.upcomingLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  dayLabel(day: string): string {
    return this.format.custom(dayKeyToDate(day), 'EEEE, d MMMM');
  }

  /** Names a training for buttons and the confirm: "Friday, 13 November 18:00 – 19:00". */
  describe(training: GymTraining): string {
    return `${this.dayLabel(training.date)} ${timeRange(training.trainingTime)}`;
  }

  /** A training that has started: no actions and no "closed" note any more. */
  isPast(training: GymTraining): boolean {
    return new Date(training.startsAt).getTime() <= Date.now();
  }

  /** Books the training, then shows the confirmation with its details (as the Schedule does). */
  book(training: GymTraining): void {
    this.busyId = training.id;
    this.actionError = null;
    this.bookings.book(training.id).subscribe({
      next: () => {
        void this.router.navigate(['/schedule', training.id, 'booked']);
      },
      error: (error) => this.failed(error, 'traineeSchedule.bookError'),
    });
  }

  cancel(training: GymTraining): void {
    const question = this.language.t('traineeSchedule.confirmCancel', {
      training: this.describe(training),
    });
    if (!window.confirm(question)) {
      return;
    }
    this.busyId = training.id;
    this.actionError = null;
    this.bookings.cancel(training.id).subscribe({
      next: (updated) => {
        this.busyId = null;
        this.upcoming = this.upcoming.map((t) =>
          t.id === updated.id ? { ...updated, gym: t.gym } : t,
        );
        this.changeDetector.detectChanges();
      },
      error: (error) => this.failed(error, 'traineeSchedule.cancelError'),
    });
  }

  private failed(error: unknown, fallbackKey: string): void {
    this.busyId = null;
    this.actionError = apiErrorMessage(error, fallbackKey);
    // The training may have changed meanwhile (closed, cancelled elsewhere): show it as it is.
    this.loadUpcoming(true);
  }

  // ---- subscriptions and attendance ----

  private loadDashboardData(): void {
    const traineeId = this.authService.getTraineeProfileId();

    if (!traineeId) {
      this.errorMessage = i18nMessage('traineeDashboard.missingProfile');
      this.loading = false;
      this.subscriptionsLoading = false;
      this.trainingsLoading = false;
      this.changeDetector.detectChanges();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      trainings: this.attendanceService.listForTrainee(traineeId),
      subscriptions: this.subscriptionsService.listForTrainee(traineeId),
      plans: this.plansService.list(),
    }).subscribe({
      next: ({ trainings, subscriptions, plans }) => {
        this.trainings = trainings;
        this.subscriptions = subscriptions;
        this.plans = plans;
        this.subscriptionsLoading = false;
        this.trainingsLoading = false;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        const message = apiErrorMessage(error, 'traineeDashboard.loadError');
        this.errorMessage = message;
        this.subscriptionErrorMessage = message;
        this.trainingErrorMessage = message;
        this.subscriptionsLoading = false;
        this.trainingsLoading = false;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}

/** When a training ends: its start plus its training time's length. */
function trainingEndsAt(training: GymTraining): number {
  const minutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  const { startTime, endTime } = training.trainingTime;
  return (
    new Date(training.startsAt).getTime() +
    (minutes(endTime) - minutes(startTime)) * 60_000
  );
}
