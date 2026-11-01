import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { LanguageService } from '../../i18n/language.service';
import { enumLabelKey, isKnownEnum } from '../../i18n/enum-labels';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true,
  imports: [
    UiMessagePipe, 
    TranslocoPipe, 
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    IconComponent,
    PageHeaderComponent,
    SkeletonListComponent,
  ],
})
export class HomeComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);
  inactiveTrainees: InactiveTraineeReportItem[] = [];
  traineesWithoutActiveSubscription: TraineeWithoutActiveSubscriptionReportItem[] = [];
  loadingInactiveReport = false;
  loadingWithoutActiveSubscriptionReport = false;
  inactiveReportErrorMessage: UiMessage | null = null;
  withoutActiveSubscriptionReportErrorMessage: UiMessage | null = null;
  selectedInactiveSkipDays = 7;
  readonly inactiveSkipDaysOptions = [
    { label: 'home.reports.lastDays', value: 7 },
    { label: 'home.reports.lastDays', value: 30 },
    { label: 'home.reports.lastDays', value: 90 },
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
    const name = this.readString(item.name) ?? this.i18n.t('home.reports.unknown');
    const nickname = this.readString(item.nickname);
    return nickname ? `${name} (${nickname})` : name;
  }

  formatDateOrFallback(value: string | null): string {
    return this.format.dateTime(value);
  }

  formatSubscriptionSummary(subscription: AttendanceSubscriptionReport | null): string {
    if (!subscription) {
      return '—';
    }

    const parts = [
      subscription.planName ? this.part('plan', subscription.planName) : null,
      subscription.type ? this.part('type', this.planTypeLabel(subscription.type)) : null,
      subscription.startDate ? this.part('start', this.format.date(subscription.startDate)) : null,
      subscription.endDate ? this.part('end', this.format.date(subscription.endDate)) : null,
      subscription.remainingTrainings !== null
        ? this.part('remainingTrainings', subscription.remainingTrainings)
        : null,
      subscription.remainingDays !== null ? this.part('remainingDays', subscription.remainingDays) : null,
    ].filter((part): part is string => Boolean(part));

    return parts.length ? parts.join(' • ') : '—';
  }

  private part(name: string, value: string | number): string {
    return this.i18n.t(`home.reports.${name}`, { value });
  }

  private planTypeLabel(type: string): string {
    return isKnownEnum('planType', type) ? this.i18n.t(enumLabelKey('planType', type)) : type;
  }

  onInactiveSkipDaysChange(): void {
    this.loadInactiveReport();
  }

  private loadInactiveReport(): void {
    this.loadingInactiveReport = true;
    this.inactiveReportErrorMessage = null;

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
          apiErrorMessage(error, 'home.reports.inactiveError');
      },
    });
  }

  private loadWithoutActiveSubscriptionReport(): void {
    this.loadingWithoutActiveSubscriptionReport = true;
    this.withoutActiveSubscriptionReportErrorMessage = null;

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
            apiErrorMessage(error, 'home.reports.withoutError');
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
