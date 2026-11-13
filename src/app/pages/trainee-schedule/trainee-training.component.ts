import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
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
import { ExerciseVideoComponent } from './exercise-video.component';

/**
 * A trainee's training (`/schedule/:id`): when and where, the trainer, how many booked and the
 * trainee's booking, with Book or Cancel booking while the API allows it, then the workout that
 * will be done: its name, summary and exercises with their descriptions and videos.
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
    ExerciseVideoComponent,
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

  /** Back to the week of this training, in its gym, once it is known. */
  backLink: UrlTree | string = '/schedule';

  readonly range = timeRange;

  constructor(
    private readonly bookings: BookingsService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

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

  /** A training that has started: no actions and no "closed" note any more. */
  isPast(training: TrainingDetails): boolean {
    return new Date(training.startsAt).getTime() <= Date.now();
  }

  book(): void {
    if (!this.training) {
      return;
    }
    this.act(
      this.bookings.book(this.training.id),
      'traineeTraining.bookedNotice',
      'traineeSchedule.bookError',
    );
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
    this.act(
      this.bookings.cancel(training.id),
      'traineeTraining.cancelledNotice',
      'traineeSchedule.cancelError',
    );
  }

  private act(
    request: ReturnType<BookingsService['book']>,
    doneKey: string,
    fallbackKey: string,
  ): void {
    this.busy = true;
    this.actionError = null;
    this.actionDone = null;
    request.subscribe({
      next: (updated) => {
        this.busy = false;
        if (this.training) {
          // The answer names the workout by its title only: keep the page's workout.
          this.training = {
            ...this.training,
            bookedCount: updated.bookedCount,
            bookedByMe: updated.bookedByMe,
            canBook: updated.canBook,
            canCancel: updated.canCancel,
          };
        }
        this.actionDone = i18nMessage(doneKey);
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.busy = false;
        this.actionError = apiErrorMessage(error, fallbackKey);
        // The training may have changed meanwhile (closed, cancelled elsewhere): show it as it is.
        this.load(true);
      },
    });
  }
}
