import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { UiMessage, apiErrorMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { AccountsService } from '../../services/accounts.service';
import { AuthService } from '../../services/auth.service';
import {
  DayTraining,
  SchedulesService,
} from '../../services/schedules.service';
import {
  Settlement,
  SettlementsService,
} from '../../services/settlements.service';
import { SubscriptionRenewalsService } from '../../services/subscription-renewals.service';
import { addDays, dayKeyToDate, localDayKey } from '../../utils/calendar.util';
import { timeRange } from '../schedules/schedule-slot-form.component';
import {
  DashboardDay,
  TrainingScope,
  TrainingStatus,
  canRegister,
  dashboardDays,
  initialScope,
  registerQuery,
  rememberScope,
  settlementToFinalize,
  trainingStatus,
} from './staff-dashboard';
import { AdventCalendarComponent } from '../../holidays/advent-calendar.component';

/**
 * The staff's dashboard (`/home`, ADMIN and TRAINER): today's and tomorrow's trainings of every
 * gym (the trainer's own by default), each with whether attendance is registered and a Register
 * attendance link filled in with it; for admins, what is waiting for them (accounts to connect, a
 * report to finalize); then shortcuts to the pages used around a training.
 */
@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    ChipComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
    AdventCalendarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './staff-dashboard.component.html',
  styleUrls: ['./dashboard-trainings.scss', './staff-dashboard.component.scss'],
})
export class StaffDashboardComponent implements OnInit {
  private readonly schedules = inject(SchedulesService);
  private readonly accounts = inject(AccountsService);
  private readonly settlements = inject(SettlementsService);
  private readonly renewals = inject(SubscriptionRenewalsService);
  private readonly language = inject(LanguageService);
  private readonly format = inject(LocaleFormatService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);

  readonly isAdmin = this.auth.getUserRole() === 'ADMIN';
  /** Admins see "Mine" only when their account is linked to a trainer profile. */
  readonly trainerId = this.auth.getTrainerProfileId();
  readonly range = timeRange;
  readonly scopeOptions: SegmentedOption<TrainingScope>[] = [
    { value: 'mine', label: 'dashboard.trainings.mine' },
    { value: 'all', label: 'dashboard.trainings.all' },
  ];
  scope: TrainingScope = initialScope(this.trainerId);

  readonly today = localDayKey(new Date())!;
  readonly tomorrow = addDays(this.today, 1);
  trainings: DayTraining[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  /** Accounts waiting to be connected (admins). */
  waitingAccounts = 0;
  /** The draft report an admin can finalize now. */
  finalizable: Settlement | null = null;
  /** Trainees whose subscription is used up or expired. */
  toRenew = 0;

  ngOnInit(): void {
    this.load();
    this.renewals.overview().subscribe({
      next: (renewals) => {
        this.toRenew =
          renewals.punch.exhausted.length + renewals.time.exhausted.length;
        this.changeDetector.detectChanges();
      },
      // The shortcut works without its count.
      error: () => undefined,
    });
    if (this.isAdmin) {
      this.accounts.list('unlinked').subscribe({
        next: (accounts) => {
          this.waitingAccounts = accounts.length;
          this.changeDetector.detectChanges();
        },
        error: () => undefined,
      });
      this.settlements.list().subscribe({
        next: (settlements) => {
          this.finalizable = settlementToFinalize(settlements, this.today);
          this.changeDetector.detectChanges();
        },
        error: () => undefined,
      });
    }
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    this.schedules.trainings(this.today, this.tomorrow).subscribe({
      next: (answer) => {
        this.trainings = answer.slots;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'dashboard.trainings.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  selectScope(scope: TrainingScope): void {
    this.scope = scope;
    rememberScope(scope);
  }

  get days(): DashboardDay[] {
    return dashboardDays(
      this.trainings,
      this.today,
      this.tomorrow,
      this.scope,
      this.trainerId,
    );
  }

  /** "Saturday, 21 November". */
  dayLabel(date: string): string {
    return this.format.custom(dayKeyToDate(date), 'EEEE, d MMMM');
  }

  /** Names a training for its buttons: "Saturday, 21 November 18:00 – 19:00, Center". */
  describe(training: DayTraining): string {
    return `${this.dayLabel(training.date)} ${timeRange(training.trainingTime)}, ${training.gym.name}`;
  }

  status(training: DayTraining): TrainingStatus {
    return trainingStatus(training, new Date());
  }

  canRegister(training: DayTraining): boolean {
    return canRegister(training, this.today);
  }

  registerQuery(training: DayTraining): Record<string, string> {
    return registerQuery(training);
  }

  /** "1 – 15 Nov 2026". */
  period(settlement: Settlement): string {
    return this.language.t('dashboard.attention.period', {
      from: this.format.custom(settlement.periodStart, 'd MMM'),
      to: this.format.date(settlement.periodEnd),
    });
  }
}
