import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../components/avatar/avatar.component';
import { IconComponent } from '../components/icon/icon.component';
import { LocaleFormatService } from '../i18n/locale-format.service';
import { AuthService } from '../services/auth.service';
import { TraineesService, YearInReview } from '../services/trainees.service';
import { HolidayService } from './holiday.service';
import {
  YearSlide,
  streakTier,
  timeOfDay,
  trainingsTier,
  yearSlides,
} from './year-in-review';

/**
 * The trainee's year in review (Dec 27 – Jan 10, at the top of their dashboard): a card that
 * plays a short story of their year at the gym, a slide at a time, in a modal dialog. Shown
 * whatever the holiday effects switch says (it is content, not an effect), and only when the year
 * had a training; a failed request just leaves the card out.
 */
@Component({
  selector: 'app-year-in-review',
  standalone: true,
  imports: [TranslocoPipe, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './year-in-review.component.html',
  styleUrl: './year-in-review.component.scss',
  // The arrow keys step while the story is open, wherever the focus is (a tap on the slide can
  // leave it on the page behind).
  host: { '(document:keydown)': 'handleKeydown($event)' },
})
export class YearInReviewComponent {
  readonly holidays = inject(HolidayService);
  private readonly trainees = inject(TraineesService);
  private readonly format = inject(LocaleFormatService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  /** A trainee with a profile: the API reads the year from the token's profile. */
  private readonly isTrainee =
    this.auth.getUserRole() === 'TRAINEE' && !!this.auth.getTraineeProfileId();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly review = signal<YearInReview | null>(null);
  readonly slides = computed(() => yearSlides(this.review()));
  readonly index = signal(0);
  readonly slide = computed<YearSlide | null>(
    () => this.slides()[this.index()] ?? null,
  );
  readonly isLast = computed(() => this.index() === this.slides().length - 1);

  /** The year as text: ICU would group its digits ("2,026") if it were a number. */
  readonly yearText = computed(() => String(this.review()?.year ?? ''));
  readonly nextYearText = computed(() =>
    String((this.review()?.year ?? 0) + 1),
  );

  private loadedSeason: number | null = null;

  constructor() {
    effect(() => {
      const state = this.holidays.state();
      if (
        !this.isTrainee ||
        !state.yearInReview ||
        state.season === null ||
        state.season === this.loadedSeason
      ) {
        return;
      }
      this.loadedSeason = state.season;
      this.trainees
        .getMyYearInReview(state.season)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (review) => this.review.set(review),
          error: () => this.review.set(null),
        });
    });
  }

  play(): void {
    this.index.set(0);
    this.dialog()?.nativeElement.showModal();
  }

  close(): void {
    this.dialog()?.nativeElement.close();
  }

  next(): void {
    if (this.isLast()) {
      this.close();
    } else {
      this.index.update((index) => index + 1);
    }
  }

  previous(): void {
    this.index.update((index) => Math.max(0, index - 1));
  }

  /** As in other stories: a tap on the left third goes back, anywhere else forward. */
  handleSlideClick(event: MouseEvent): void {
    const area = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (area.width && event.clientX - area.left < area.width / 3) {
      this.previous();
    } else {
      this.next();
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (!this.dialog()?.nativeElement.open) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (!this.isLast()) {
        this.next();
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
    }
  }

  handleDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }

  number(value: number): string {
    return this.format.number(value);
  }

  firstDay(review: YearInReview): string {
    return this.format.date(review.firstTrainingOn);
  }

  /** The month's name as a title ("October", "Октомври"). */
  monthName(month: number): string {
    const year = this.review()?.year ?? 2000;
    const name = this.format.custom(new Date(year, month - 1, 1), 'LLLL');
    return name.charAt(0).toLocaleUpperCase() + name.slice(1);
  }

  trainingsKey(review: YearInReview): string {
    return `holidays.yearInReview.trainings.${trainingsTier(review.trainings)}`;
  }

  timeKey(time: string): string {
    return `holidays.yearInReview.time.${timeOfDay(time)}`;
  }

  streakKey(weeks: number): string {
    return `holidays.yearInReview.streak.${streakTier(weeks)}`;
  }
}
