import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
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
  imports: [CommonModule],
  templateUrl: './trainee-dashboard.component.html',
  styleUrl: './trainee-dashboard.component.scss',
})
export class TraineeDashboardComponent implements OnInit {
  loading = true;
  errorMessage = '';
  paidTrainings: AttendanceTraineeTrainingItem[] = [];
  unpaidTrainings: AttendanceTraineeTrainingItem[] = [];
  activeSubscriptions: Subscription[] = [];
  pastSubscriptions: Subscription[] = [];
  private plans: Plan[] = [];

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: PlansService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
  }

  formatPrice(priceCents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(priceCents / 100);
  }

  formatPlanLabel(subscription: Subscription): string {
    const plan = this.plans.find(entry => entry.id === subscription.planId);
    return plan ? plan.title : subscription.planId;
  }

  formatEndsOrCredits(subscription: Subscription): string {
    if (subscription.type === 'TIME') {
      return subscription.endsAt ? this.formatDate(subscription.endsAt) : '—';
    }

    const initial = subscription.initialCredits ?? 0;
    const remaining = subscription.remainingCredits ?? 0;
    const used = Math.max(initial - remaining, 0);
    return `${used} / ${initial} trainings`;
  }

  trackByTraining(_: number, item: AttendanceTraineeTrainingItem): string {
    return item.id;
  }

  trackBySubscription(_: number, subscription: Subscription): string {
    return subscription.id;
  }

  private loadDashboardData(): void {
    const traineeId = this.authService.getTraineeProfileId();

    if (!traineeId) {
      this.errorMessage = 'Unable to load your dashboard. Missing trainee profile identifier.';
      this.loading = false;
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
        this.plans = plans;
        this.activeSubscriptions = subscriptions.filter(
          subscription => subscription.status.toUpperCase() === 'ACTIVE',
        );
        this.pastSubscriptions = subscriptions.filter(
          subscription => subscription.status.toUpperCase() !== 'ACTIVE',
        );
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load your dashboard right now. Please try again later.';
        this.loading = false;
      },
    });
  }
}
