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

@Component({
  selector: 'app-trainee-dashboard',
  standalone: true,
  imports: [CommonModule, TraineeSubscriptionsTableComponent, TraineeTrainingsTableComponent],
  templateUrl: './trainee-dashboard.component.html',
  styleUrl: './trainee-dashboard.component.scss',
})
export class TraineeDashboardComponent implements OnInit {
  loading = true;
  errorMessage = '';

  subscriptions: Subscription[] = [];
  subscriptionsLoading = true;
  subscriptionErrorMessage = '';

  paidTrainings: AttendanceTraineeTrainingItem[] = [];
  unpaidTrainings: AttendanceTraineeTrainingItem[] = [];
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
      paid: this.attendanceService.listPaidForTrainee(traineeId),
      unpaid: this.attendanceService.listUnpaidForTrainee(traineeId),
      subscriptions: this.subscriptionsService.listForTrainee(traineeId),
      plans: this.plansService.list(),
    }).subscribe({
      next: ({ paid, unpaid, subscriptions, plans }) => {
        this.paidTrainings = paid;
        this.unpaidTrainings = unpaid;
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
