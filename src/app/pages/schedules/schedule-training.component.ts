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
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { TrainingWorkoutComponent } from '../trainee-schedule/training-workout.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  ScheduleTraining,
  TrainingAttendeeRow,
  TrainingBookingRow,
} from '../../services/schedules.service';
import { SchedulesService } from '../../services/schedules.service';
import { dayKeyToDate, localDayKey } from '../../utils/calendar.util';
import { formatTimeWithoutSeconds } from '../../utils/time-display';
import { timeRange } from './schedule-slot-form.component';

/** The two lists of the training page: who came (attendance saved) and who booked. */
export type TrainingTab = 'attended' | 'booked';

/**
 * One training of a week for staff (`/workouts/schedule/:id`): when and where, the trainer, then
 * two tabs of trainees, each a link to their page with what their subscriptions have left:
 * **Attended** (attendance saved for the training, walk-ins included, with a "Didn't book" chip)
 * and **Booked** (projected, as if they come, until their attendance is saved; "Not registered"
 * once others' is). Attended is the default once anyone's attendance is saved, else Booked;
 * `?tab=` keeps a choice (the entry replaced), so going back from a trainee returns to it. Then
 * its workout as trainees see it (`app-training-workout`). From the training's day on, "Register
 * attendance" opens that page filled in with the training and the booked trainees.
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
    SegmentedControlComponent,
    TrainingWorkoutComponent,
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

  /** The list shown; see `defaultTab`. */
  tab: TrainingTab = 'booked';

  readonly range = timeRange;

  private tabOptionsKey = '';
  private tabOptionsCache: SegmentedOption<TrainingTab>[] = [];

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
        this.tab = this.tabFromUrl() ?? this.defaultTab(training);
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

  /** Who came once anyone's attendance is saved for the training, else who booked. */
  defaultTab(training: ScheduleTraining): TrainingTab {
    return training.attendees.length ? 'attended' : 'booked';
  }

  /** "Attended · 3" / "Booked · 2", in the page's language. */
  get tabOptions(): SegmentedOption<TrainingTab>[] {
    const training = this.training;
    const attended = training?.attendees.length ?? 0;
    const booked = training?.trainees.length ?? 0;
    const key = `${this.language.lang()}|${attended}|${booked}`;
    if (key !== this.tabOptionsKey) {
      this.tabOptionsKey = key;
      this.tabOptionsCache = [
        {
          value: 'attended',
          label: this.tabLabel('schedules.training.tabAttended', attended),
        },
        {
          value: 'booked',
          label: this.tabLabel('schedules.training.tabBooked', booked),
        },
      ];
    }
    return this.tabOptionsCache;
  }

  /** Shows the other list and keeps the choice in the address, replacing the entry. */
  selectTab(tab: TrainingTab): void {
    this.tab = tab;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Booked trainees not registered while others' attendance is saved: they may have skipped it. */
  notRegistered(row: TrainingBookingRow): boolean {
    return !row.attendanceSaved && !!this.training?.attendees.length;
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

  /** The second line of a booked row: the plan, when a period ends, and whether it is projected. */
  note(row: TrainingBookingRow): string {
    return [
      ...this.subscriptionNote(row, row.attendanceSaved),
      this.language.t(
        row.attendanceSaved
          ? 'schedules.training.attendanceSaved'
          : 'schedules.training.ifTheyCome',
      ),
    ].join(' · ');
  }

  /** The second line of an attended row: the plan that paid, and when a period ends. */
  attendeeNote(row: TrainingAttendeeRow): string {
    return this.subscriptionNote(row, true).join(' · ');
  }

  private subscriptionNote(
    row: Pick<TrainingBookingRow, 'subscription'>,
    saved: boolean,
  ): string[] {
    const parts: string[] = [];
    const subscription = row.subscription;
    if (!subscription) {
      parts.push(
        this.language.t(
          saved
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
    return parts;
  }

  /** The key figure: what would be left after this training, or what is left now once saved. */
  chip(
    row: Pick<TrainingBookingRow, 'subscription' | 'attendanceSaved'>,
  ): string {
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

  /** An attended row's key figure: what is left now. */
  attendeeChip(row: TrainingAttendeeRow): string {
    return this.chip({ subscription: row.subscription, attendanceSaved: true });
  }

  tone(row: Pick<TrainingBookingRow, 'level'>): ChipTone {
    if (row.level === 'UNPAID') {
      return 'danger';
    }
    return row.level === 'OK' ? 'neutral' : 'warning';
  }

  /** Trainees who need attention: unpaid, or at or near the end of their subscription. */
  attentionCount(rows: Pick<TrainingBookingRow, 'level'>[]): number {
    return rows.filter((t) => t.level !== 'OK').length;
  }

  private tabFromUrl(): TrainingTab | null {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    return tab === 'attended' || tab === 'booked' ? tab : null;
  }

  private tabLabel(key: string, count: number): string {
    return this.language.t('schedules.training.tabCount', {
      label: this.language.t(key),
      count: this.format.number(count),
    });
  }
}
