import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppleCalendarButtonComponent } from '../../components/apple-calendar-button/apple-calendar-button.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { GoogleCalendarButtonComponent } from '../../components/google-calendar-button/google-calendar-button.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { StatusDotComponent } from '../../components/status-dot/status-dot.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  BookableTraining,
  BookingsService,
  TrainingDetails,
} from '../../services/bookings.service';
import { dayKeyToDate } from '../../utils/calendar.util';
import { timeRange } from '../schedules/schedule-slot-form.component';
import { mondayOf } from '../workouts/workouts.component';
import { noWorkoutMessage } from './no-workout-message';
import { trainingCalendarUrl } from './training-calendar';
import { TrainingWorkoutComponent } from './training-workout.component';
import { HolidayService } from '../../holidays/holiday.service';

/**
 * A trainee's training (`/schedule/:id`): when and where (the gym's address too), the trainer, how
 * many booked and the trainee's booking, with Book or Cancel booking while the API allows it and,
 * once booked, Add to Google Calendar; then the workout that will be done: its name, summary and
 * exercises with their descriptions and videos.
 *
 * The same page is the booking confirmation (`/schedule/:id/booked`, route data
 * `confirmation: true`), where both Books lead: there it reads "You're booked" with a success
 * notice while the trainee is booked, and says so when they aren't (cancelled meanwhile).
 */
@Component({
  selector: 'app-trainee-training',
  standalone: true,
  imports: [
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusDotComponent,
    GoogleCalendarButtonComponent,
    AppleCalendarButtonComponent,
    IconComponent,
    TrainingWorkoutComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './trainee-training.component.html',
  styleUrl: './trainee-training.component.scss',
})
export class TraineeTrainingComponent implements OnInit {
  training: TrainingDetails | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;

  busy = false;
  actionError: UiMessage | null = null;
  actionDone: UiMessage | null = null;

  /** The booking confirmation (`/schedule/:id/booked`) rather than the training's page. */
  readonly confirmation: boolean;

  /** Back to the week of this training, in its gym, once it is known. */
  backLink: UrlTree | string = '/schedule';

  readonly range = timeRange;

  private readonly holidays = inject(HolidayService);
  constructor(
    private readonly bookings: BookingsService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.confirmation = this.route.snapshot.data['confirmation'] === true;
  }

  ngOnInit(): void {
    this.load();
  }

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  /** Loads the training; `keepMessages` keeps a failed action's message above it. */
  load(keepMessages = false): void {
    this.loading = !this.training;
    this.errorMessage = null;
    if (!keepMessages) {
      this.actionError = null;
      this.actionDone = null;
    }
    this.bookings.training(this.id).subscribe({
      next: (training) => {
        this.training = training;
        this.backLink = this.router.createUrlTree(['/schedule'], {
          queryParams: { gym: training.gym.id, week: mondayOf(training.date) },
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'traineeTraining.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  dayLabel(day: string): string {
    return this.format.custom(dayKeyToDate(day), 'EEEE, d MMMM');
  }

  /** Names the training for buttons and the confirm: "Friday, 13 November 18:00 – 19:00". */
  describe(training: BookableTraining | TrainingDetails): string {
    return `${this.dayLabel(training.date)} ${timeRange(training.trainingTime)}`;
  }

  noWorkoutMessage(training: TrainingDetails): string {
    return noWorkoutMessage(
      training.workoutReleasesAt,
      this.language,
      this.format,
    );
  }

  /** The page's title: "You're booked" on the confirmation, else the workout's name. */
  title(training: TrainingDetails | null): string {
    if (this.confirmation && (!training || training.bookedByMe)) {
      return this.language.t('traineeBooked.title');
    }
    return training?.workout?.title || this.language.t('traineeTraining.title');
  }

  calendarUrl(training: TrainingDetails): string {
    return trainingCalendarUrl(training, this.language, this.router);
  }

  /** The training's `.ics` file (Apple Calendar), in the page's language; null when not booked. */
  calendarFileUrl(training: TrainingDetails): string | null {
    return training.calendarToken
      ? this.bookings.calendarFileUrl(
          training.calendarToken,
          this.language.lang(),
        )
      : null;
  }

  /** The tile of the Apple Calendar button: the training's weekday and day. */
  calendarTile(training: TrainingDetails): { weekday: string; day: string } {
    const date = dayKeyToDate(training.date);
    return {
      weekday: this.format.custom(date, 'EEE'),
      day: this.format.custom(date, 'd'),
    };
  }

  /** A training that has started: no actions and no "closed" note any more. */
  isPast(training: TrainingDetails): boolean {
    return new Date(training.startsAt).getTime() <= Date.now();
  }

  /**
   * Books the training, then shows the confirmation (`/schedule/:id/booked`). On the confirmation
   * itself (booked again after cancelling), the page just shows the training booked.
   */
  book(): void {
    const training = this.training;
    if (!training) {
      return;
    }
    this.busy = true;
    this.actionError = null;
    this.actionDone = null;
    this.bookings.book(training.id).subscribe({
      next: (updated) => {
        this.holidays.celebrate('book');
        if (this.confirmation) {
          this.applyBooking(updated);
          this.changeDetector.detectChanges();
          // The booking's calendar file needs its new token.
          this.load();
          return;
        }
        void this.router.navigate(['/schedule', training.id, 'booked']);
      },
      error: (error) => this.failed(error, 'traineeSchedule.bookError'),
    });
  }

  cancel(): void {
    const training = this.training;
    if (!training) {
      return;
    }
    const question = this.language.t('traineeSchedule.confirmCancel', {
      training: this.describe(training),
    });
    if (!window.confirm(question)) {
      return;
    }
    this.busy = true;
    this.actionError = null;
    this.actionDone = null;
    this.bookings.cancel(training.id).subscribe({
      next: (updated) => {
        this.applyBooking(updated);
        this.actionDone = i18nMessage('traineeTraining.cancelledNotice');
        this.changeDetector.detectChanges();
      },
      error: (error) => this.failed(error, 'traineeSchedule.cancelError'),
    });
  }

  /** A book or cancel answer: it names the workout by its title only, so keep the page's. */
  private applyBooking(updated: BookableTraining): void {
    this.busy = false;
    if (this.training) {
      this.training = {
        ...this.training,
        bookedCount: updated.bookedCount,
        bookedByMe: updated.bookedByMe,
        canBook: updated.canBook,
        canCancel: updated.canCancel,
      };
    }
  }

  private failed(error: unknown, fallbackKey: string): void {
    this.busy = false;
    this.actionError = apiErrorMessage(error, fallbackKey);
    // The training may have changed meanwhile (closed, cancelled elsewhere): show it as it is.
    this.load(true);
  }
}
