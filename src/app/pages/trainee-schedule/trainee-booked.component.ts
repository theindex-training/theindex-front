import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  BookingsService,
  TrainingDetails,
} from '../../services/bookings.service';
import { dayKeyToDate } from '../../utils/calendar.util';
import { timeRange } from '../schedules/schedule-slot-form.component';
import { mondayOf } from '../workouts/workouts.component';
import { googleCalendarUrl } from './google-calendar';
import { noWorkoutMessage } from './no-workout-message';
import { TrainingWorkoutComponent } from './training-workout.component';

/**
 * The confirmation a trainee sees after booking a training (`/schedule/:id/booked`), from the
 * Schedule's Book or the training's page: when, where (the gym's address) and with whom, a link
 * that adds it to Google Calendar, then the workout as the training's page shows it. It reads the
 * training again, so a reload, or a booking cancelled meanwhile, shows what is true now.
 */
@Component({
  selector: 'app-trainee-booked',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
    TrainingWorkoutComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './trainee-booked.component.html',
  styleUrl: './trainee-booked.component.scss',
})
export class TraineeBookedComponent implements OnInit {
  training: TrainingDetails | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;

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

  load(): void {
    this.loading = true;
    this.errorMessage = null;
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

  /** "Friday, 13 November 18:00 – 19:00". */
  describe(training: TrainingDetails): string {
    return `${this.dayLabel(training.date)} ${timeRange(training.trainingTime)}`;
  }

  noWorkoutMessage(training: TrainingDetails): string {
    return noWorkoutMessage(
      training.workoutReleasesAt,
      this.language,
      this.format,
    );
  }

  /**
   * Google Calendar with the training filled in: "CrossFit training", its start and end, the gym's
   * address (else its name), and the trainer, the workout's name once it is out and a link back
   * to the training's page in the description. In the language the page is shown in.
   */
  calendarUrl(training: TrainingDetails): string {
    const page = new URL(
      this.router.serializeUrl(
        this.router.createUrlTree(['/schedule', training.id]),
      ),
      document.baseURI,
    ).href;
    const details = [
      this.language.t('traineeBooked.calendar.trainer', {
        name: training.trainer.name,
      }),
      training.workout?.title
        ? this.language.t('traineeBooked.calendar.workout', {
            title: training.workout.title,
          })
        : null,
      page,
    ].filter((line): line is string => !!line);
    return googleCalendarUrl({
      title: this.language.t('traineeBooked.calendar.title'),
      startsAt: training.startsAt,
      endsAt: training.endsAt,
      location: training.gym.address?.trim() || training.gym.name,
      details: details.join('\n'),
    });
  }
}
