import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AttendanceReportItem, AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin, finalize } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
})
export class HomeComponent implements OnInit {
  inactiveTrainees: AttendanceReportItem[] = [];
  traineesWithoutActiveSubscription: AttendanceReportItem[] = [];

  inactiveColumns: string[] = [];
  withoutSubscriptionColumns: string[] = [];

  loadingReports = false;
  reportsErrorMessage = '';
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

    this.loadReports();
  }

  resolveTraineeId(item: AttendanceReportItem): string | null {
    return (
      this.readString(item.traineeId) ??
      this.readString(item.id) ??
      this.readString(item.trainee?.traineeId) ??
      this.readString(item.trainee?.id) ??
      null
    );
  }

  traineeDisplayName(item: AttendanceReportItem): string {
    const name = this.readString(item.name) ?? this.readString(item.trainee?.name) ?? 'Unknown';
    const nickname = this.readString(item.nickname) ?? this.readString(item.trainee?.nickname);
    return nickname ? `${name} (${nickname})` : name;
  }

  formatReportValue(item: AttendanceReportItem, key: string): string {
    const value = item[key];

    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
      return `${value}`;
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value);
  }

  columnLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/^./, value => value.toUpperCase());
  }

  onInactiveSkipDaysChange(): void {
    this.loadReports();
  }

  private loadReports(): void {
    this.loadingReports = true;
    this.reportsErrorMessage = '';

    forkJoin({
      inactive: this.attendanceService.getInactiveTraineesReport({
        skipDays: this.selectedInactiveSkipDays,
      }),
      withoutActiveSubscription:
        this.attendanceService.getTraineesWithoutActiveSubscriptionReport(),
    })
      .pipe(
        finalize(() => {
          this.loadingReports = false;
          this.changeDetector.detectChanges();
        }),
      )
      .subscribe({
      next: result => {
        this.inactiveTrainees = result.inactive;
        this.traineesWithoutActiveSubscription = result.withoutActiveSubscription;
        this.inactiveColumns = this.buildReportColumns(result.inactive);
        this.withoutSubscriptionColumns = this.buildReportColumns(result.withoutActiveSubscription);
      },
      error: error => {
        this.reportsErrorMessage =
          error?.error?.message || 'Unable to load attendance reports right now.';
      },
    });
  }

  private buildReportColumns(rows: AttendanceReportItem[]): string[] {
    const ignoredKeys = new Set(['id', 'traineeId', 'name', 'nickname', 'trainee']);
    const columns = new Set<string>();

    rows.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!ignoredKeys.has(key)) {
          columns.add(key);
        }
      });
    });

    return [...columns];
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }
}
