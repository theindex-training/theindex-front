import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { TraineeSubscriptionsTableComponent } from '../../components/trainee-subscriptions-table/trainee-subscriptions-table.component';
import { TraineeTrainingsTableComponent } from '../../components/trainee-trainings-table/trainee-trainings-table.component';
import {
  AttendanceService,
  AttendanceTraineeTrainingItem,
} from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { Plan, PlansService } from '../../services/plans.service';
import { Subscription, SubscriptionsService } from '../../services/subscriptions.service';

type SubscriptionFilter = 'PAID' | 'UNPAID' | 'ALL';

@Component({
  selector: 'app-trainee-dashboard',
  standalone: true,
  imports: [CommonModule, TraineeSubscriptionsTableComponent, TraineeTrainingsTableComponent],
  templateUrl: './trainee-dashboard.component.html',
  styleUrl: './trainee-dashboard.component.scss',
})
export class TraineeDashboardComponent implements OnInit {
  subscriptionFilter: SubscriptionFilter = 'PAID';

  loading = true;
  errorMessage = '';

  subscriptions: Subscription[] = [];
  subscriptionsLoading = true;
  subscriptionErrorMessage = '';

  trainings: AttendanceTraineeTrainingItem[] = [];
  trainingsLoading = true;
  trainingErrorMessage = '';

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

    return this.subscriptions.filter((subscription) =>
      this.subscriptionFilter === 'PAID' ? subscription.paidCents > 0 : subscription.paidCents <= 0,
    );
  }

  get filteredSubscriptionsEmptyMessage(): string {
    if (this.subscriptionFilter === 'PAID') {
      return 'No paid subscriptions found for your profile.';
    }

    if (this.subscriptionFilter === 'UNPAID') {
      return 'No unpaid subscriptions found for your profile.';
    }

    return 'No subscriptions found for your profile.';
  }

  private loadDashboardData(): void {
    const traineeId = this.authService.getTraineeProfileId();

    if (!traineeId) {
      this.errorMessage = 'Unable to load your dashboard. Missing trainee profile identifier.';
      this.loading = false;
      this.subscriptionsLoading = false;
      this.trainingsLoading = false;
      this.changeDetector.detectChanges();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

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
        const message =
          error?.error?.message || 'Unable to load your dashboard right now. Please try again later.';
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
