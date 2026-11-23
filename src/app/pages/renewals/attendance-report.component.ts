import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, finalize } from 'rxjs';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { enumLabelKey, isKnownEnum } from '../../i18n/enum-labels';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { UiMessage, apiErrorMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  AttendanceService,
  AttendanceSubscriptionReport,
  InactiveTraineeReportItem,
  TraineeWithoutActiveSubscriptionReportItem,
} from '../../services/attendance.service';
import { timePassLastDay } from '../../utils/time-pass.util';

/** Which attendance report: trainees who stopped coming, or trainees without a subscription. */
export type AttendanceReportKind = 'inactive' | 'without';

type ReportItem =
  InactiveTraineeReportItem | TraineeWithoutActiveSubscriptionReportItem;

/**
 * One of the attendance reports on Renewals (once on the dashboard): inactive trainees (no
 * training for 7, 30 or 90 days, with their active subscription) or trainees without an active
 * subscription (with their last one).
 */
@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    SkeletonListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './attendance-report.component.html',
  styleUrl: './attendance-report.component.scss',
})
export class AttendanceReportComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  private readonly format = inject(LocaleFormatService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @Input({ required: true }) kind: AttendanceReportKind = 'inactive';

  items: ReportItem[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;
  selectedSkipDays = 7;
  readonly skipDaysOptions = [7, 30, 90];

  ngOnInit(): void {
    this.load();
  }

  /** The subscription a row shows: the active one (inactive trainees), or the last one. */
  subscriptionOf(item: ReportItem): AttendanceSubscriptionReport | null {
    return 'activeSubscription' in item
      ? item.activeSubscription
      : item.lastActiveSubscription;
  }

  traineeDisplayName(item: {
    name?: string;
    nickname?: string | null;
  }): string {
    const name =
      this.readString(item.name) ?? this.i18n.t('renewals.reports.unknown');
    const nickname = this.readString(item.nickname);
    return nickname ? `${name} (${nickname})` : name;
  }

  formatDateOrFallback(value: string | null): string {
    return this.format.dateTime(value);
  }

  formatSubscriptionSummary(
    subscription: AttendanceSubscriptionReport | null,
  ): string {
    if (!subscription) {
      return '—';
    }

    const parts = [
      subscription.planName ? this.part('plan', subscription.planName) : null,
      subscription.type
        ? this.part('type', this.planTypeLabel(subscription.type))
        : null,
      subscription.startDate
        ? this.part('start', this.format.date(subscription.startDate))
        : null,
      subscription.endDate
        ? this.part(
            'end',
            this.format.date(timePassLastDay(subscription.endDate)),
          )
        : null,
      subscription.remainingTrainings !== null
        ? this.part('remainingTrainings', subscription.remainingTrainings)
        : null,
      subscription.remainingDays !== null
        ? this.part('remainingDays', subscription.remainingDays)
        : null,
    ].filter((part): part is string => Boolean(part));

    return parts.length ? parts.join(' • ') : '—';
  }

  onSkipDaysChange(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    const request: Observable<ReportItem[]> =
      this.kind === 'inactive'
        ? this.attendanceService.getInactiveTraineesReport({
            skipDays: this.selectedSkipDays,
          })
        : this.attendanceService.getTraineesWithoutActiveSubscriptionReport();

    request
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.detectChanges();
        }),
      )
      .subscribe({
        next: (result) => {
          this.items = result;
        },
        error: (error: unknown) => {
          this.errorMessage = apiErrorMessage(
            error,
            this.kind === 'inactive'
              ? 'renewals.reports.inactiveError'
              : 'renewals.reports.withoutError',
          );
        },
      });
  }

  private part(name: string, value: string | number): string {
    return this.i18n.t(`renewals.reports.${name}`, { value });
  }

  private planTypeLabel(type: string): string {
    return isKnownEnum('planType', type)
      ? this.i18n.t(enumLabelKey('planType', type))
      : type;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }
}
