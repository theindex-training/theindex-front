import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  SegmentedControlComponent,
  SegmentedOption
} from '../../components/segmented-control/segmented-control.component';
import { TraineeSubscriptionsTableComponent } from '../../components/trainee-subscriptions-table/trainee-subscriptions-table.component';
import { TraineeTrainingsTableComponent } from '../../components/trainee-trainings-table/trainee-trainings-table.component';
import {
  AttendanceService,
  AttendanceTraineeTrainingItem,
} from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { Plan, PlansService } from '../../services/plans.service';
import { Subscription, SubscriptionsService } from '../../services/subscriptions.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';

type SubscriptionFilter = 'ACTIVE' | 'EXHAUSTED' | 'ALL';

@Component({
  selector: 'app-trainee-dashboard',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, 
    CommonModule,
    EmptyStateComponent,
    PageHeaderComponent,
    SegmentedControlComponent,
    TraineeSubscriptionsTableComponent,
    TraineeTrainingsTableComponent,
  ],
  templateUrl: './trainee-dashboard.component.html',
})
export class TraineeDashboardComponent implements OnInit {
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

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: PlansService,
    private readonly authService: AuthService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  get filteredSubscriptions(): Subscription[] {
    if (this.subscriptionFilter === 'ALL') {
      return this.subscriptions;
    }

    return this.subscriptions.filter(
      (subscription) => subscription.status.toUpperCase() === this.subscriptionFilter,
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
