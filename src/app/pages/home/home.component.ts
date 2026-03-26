import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AttendanceService,
  AttendanceSubscriptionReport,
  InactiveTraineeReportItem,
  TraineeWithoutActiveSubscriptionReportItem,
} from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
})
export class HomeComponent implements OnInit {
  inactiveTrainees: InactiveTraineeReportItem[] = [];
  traineesWithoutActiveSubscription: TraineeWithoutActiveSubscriptionReportItem[] = [];
  loadingInactiveReport = false;
  loadingWithoutActiveSubscriptionReport = false;
  inactiveReportErrorMessage = '';
  withoutActiveSubscriptionReportErrorMessage = '';
  selectedInactiveSkipDays = 7;
  readonly inactiveSkipDaysOptions = [
    { label: 'Last 7 days', value: 7 },
    { label: 'Last 30 days', value: 30 },
    { label: 'Last 90 days', value: 90 },
  ];

  readonly canViewAttendanceReports: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly attendanceService: AttendanceService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    const role = this.authService.getUserRole();
    this.canViewAttendanceReports = role === 'TRAINER' || role === 'ADMIN';
  }

  ngOnInit(): void {
    if (!this.canViewAttendanceReports) {
      return;
    }

    this.loadInactiveReport();
    this.loadWithoutActiveSubscriptionReport();
  }

  traineeDisplayName(item: { name?: string; nickname?: string | null }): string {
    const name = this.readString(item.name) ?? 'Unknown';
    const nickname = this.readString(item.nickname);
    return nickname ? `${name} (${nickname})` : name;
  }

  formatDateOrFallback(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleString();
  }

  formatSubscriptionSummary(subscription: AttendanceSubscriptionReport | null): string {
    if (!subscription) {
      return '—';
    }

    const parts = [
      subscription.planName ? `Plan: ${subscription.planName}` : null,
      subscription.type ? `Type: ${subscription.type}` : null,
      subscription.startDate ? `Start: ${this.formatDateOrFallback(subscription.startDate)}` : null,
      subscription.endDate ? `End: ${this.formatDateOrFallback(subscription.endDate)}` : null,
      subscription.remainingTrainings !== null
        ? `Remaining trainings: ${subscription.remainingTrainings}`
        : null,
      subscription.remainingDays !== null ? `Remaining days: ${subscription.remainingDays}` : null,
    ].filter((part): part is string => Boolean(part));

    return parts.length ? parts.join(' • ') : '—';
  }

  onInactiveSkipDaysChange(): void {
    this.loadInactiveReport();
  }

  private loadInactiveReport(): void {
    this.loadingInactiveReport = true;
    this.inactiveReportErrorMessage = '';

    this.attendanceService
      .getInactiveTraineesReport({
        skipDays: this.selectedInactiveSkipDays,
      })
      .pipe(
        finalize(() => {
          this.loadingInactiveReport = false;
          this.changeDetector.detectChanges();
        }),
      )
      .subscribe({
      next: result => {
        this.inactiveTrainees = result;
      },
      error: error => {
        this.inactiveReportErrorMessage =
          error?.error?.message || 'Unable to load inactive trainees report right now.';
      },
    });
  }

  private loadWithoutActiveSubscriptionReport(): void {
    this.loadingWithoutActiveSubscriptionReport = true;
    this.withoutActiveSubscriptionReportErrorMessage = '';

    this.attendanceService
      .getTraineesWithoutActiveSubscriptionReport()
      .pipe(
        finalize(() => {
          this.loadingWithoutActiveSubscriptionReport = false;
          this.changeDetector.detectChanges();
        }),
      )
      .subscribe({
        next: result => {
          this.traineesWithoutActiveSubscription = result;
        },
        error: error => {
          this.withoutActiveSubscriptionReportErrorMessage =
            error?.error?.message ||
            'Unable to load trainees without active subscription report right now.';
        },
      });
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }
}
