import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChipComponent, ChipTone } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  ScheduleTraining,
  TrainingBookingRow,
} from '../../services/schedules.service';
import { SchedulesService } from '../../services/schedules.service';
import { dayKeyToDate, localDayKey } from '../../utils/calendar.util';
import { formatTimeWithoutSeconds } from '../../utils/time-display';
import { timeRange } from './schedule-slot-form.component';

/**
 * One training of a week for staff (`/workouts/schedule/:id`): when and where, the trainer and
 * workout, and the trainees who booked it, each a link to their page with what their
 * subscriptions have left. The figures are projected (as if they come and attendance is saved)
 * until attendance is saved for the training. From the training's day on, "Register attendance"
 * opens that page filled in with the training and the booked trainees.
 */
@Component({
  selector: 'app-schedule-training',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ListRowComponent,
    ChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './schedule-training.component.html',
  styleUrl: './schedule-training.component.scss',
})
export class ScheduleTrainingComponent implements OnInit {
  training: ScheduleTraining | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;

  /** Back to the week of this training, in its gym, once it is known. */
  backLink: UrlTree | string = '/workouts/schedule';

  readonly range = timeRange;

  constructor(
    private readonly schedules: SchedulesService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.schedules.training(id).subscribe({
      next: (training) => {
        this.training = training;
        this.backLink = this.router.createUrlTree(['/workouts/schedule'], {
          queryParams: { gym: training.gym.id, week: training.weekStart },
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'schedules.training.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  dayLabel(day: string): string {
    return this.format.custom(dayKeyToDate(day), 'EEEE, d MMMM');
  }

  /** Names the training: "Friday, 13 November 18:00 – 19:00". */
  describe(training: ScheduleTraining): string {
    return `${this.dayLabel(training.date)} ${timeRange(training.trainingTime)}`;
  }

  /** Attendance is registered from the training's day on, not ahead of it. */
  canRegister(training: ScheduleTraining): boolean {
    return training.date <= (localDayKey(new Date()) ?? '');
  }

  /**
   * Register attendance filled in with this training: its day, start, trainer and gym, and the
   * booked trainees who are active and whose attendance isn't saved for it yet.
   */
  registerLink(training: ScheduleTraining): UrlTree {
    const trainees = training.trainees
      .filter((t) => t.isActive && !t.attendanceSaved)
      .map((t) => t.traineeId);
    return this.router.createUrlTree(['/attendance/new'], {
      queryParams: {
        date: training.date,
        time: formatTimeWithoutSeconds(training.trainingTime.startTime),
        trainer: training.trainer.id,
        gym: training.gym.id,
        ...(trainees.length ? { trainees: trainees.join(',') } : {}),
      },
    });
  }

  /** The second line of a row: the plan, when a period ends, and whether it is projected. */
  note(row: TrainingBookingRow): string {
    const parts: string[] = [];
    const subscription = row.subscription;
    if (!subscription) {
      parts.push(
        this.language.t(
          row.attendanceSaved
            ? 'schedules.training.savedUnpaid'
            : 'attendance.register.summary.noSubscription',
        ),
      );
    } else {
      parts.push(subscription.planTitle);
      if (subscription.type === 'TIME' && subscription.endsAt) {
        parts.push(
          this.language.t('attendance.register.summary.endsOn', {
            date: this.format.date(subscription.endsAt),
          }),
        );
      }
    }
    parts.push(
      this.language.t(
        row.attendanceSaved
          ? 'schedules.training.attendanceSaved'
          : 'schedules.training.ifTheyCome',
      ),
    );
    return parts.join(' · ');
  }

  /** The key figure: what would be left after this training, or what is left now once saved. */
  chip(row: TrainingBookingRow): string {
    const subscription = row.subscription;
    if (!subscription) {
      return this.language.t('attendance.register.summary.unpaid');
    }
    if (subscription.type === 'TIME') {
      return this.language.t('attendance.register.summary.daysLeft', {
        count: subscription.daysLeft ?? 0,
      });
    }
    const left = subscription.remainingCredits ?? 0;
    if (row.attendanceSaved) {
      return left <= 0
        ? this.language.t('schedules.training.noneLeft')
        : this.language.t('attendance.register.summary.creditsLeft', {
            count: left,
          });
    }
    return left <= 0
      ? this.language.t('attendance.register.summary.lastTraining')
      : this.language.t('schedules.training.leftAfter', { count: left });
  }

  tone(row: TrainingBookingRow): ChipTone {
    if (row.level === 'UNPAID') {
      return 'danger';
    }
    return row.level === 'OK' ? 'neutral' : 'warning';
  }

  /** Trainees who need attention: unpaid, or at or near the end of their subscription. */
  attentionCount(training: ScheduleTraining): number {
    return training.trainees.filter((t) => t.level !== 'OK').length;
  }
}
