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
import { environment } from '@environments/environment';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../components/avatar/avatar.component';
import { IconComponent } from '../components/icon/icon.component';
import { LanguageService } from '../i18n/language.service';
import { LocaleFormatService } from '../i18n/locale-format.service';
import type { TranslationParams } from '../i18n/ui-message';
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
import { YearShareContent, shareFileName, shareRows } from './year-share-image';
import { YearShareService } from './year-share.service';

/** Where sharing the picture stands: being made, saved as a download, or failed. */
export type ShareStatus = 'idle' | 'making' | 'saved' | 'error';

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
  private readonly language = inject(LanguageService);
  private readonly shares = inject(YearShareService);
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

  readonly shareStatus = signal<ShareStatus>('idle');

  private loadedSeason: number | null = null;
  /**
   * The picture, made as soon as the summary shows (for its year and language): a phone lets a
   * page open the share sheet only shortly after the tap, so Share mustn't wait for the drawing.
   */
  private prepared: { key: string; file: Promise<File | null> } | null = null;

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

    effect(() => {
      const review = this.review();
      if (review && this.slide() === 'summary') {
        void this.prepare(review);
      }
    });
  }

  /** Shares the year's picture (the share sheet on phones), else saves it as a download. */
  async share(): Promise<void> {
    const review = this.review();
    if (!review || this.shareStatus() === 'making') {
      return;
    }
    this.shareStatus.set('making');
    const file = await this.prepare(review);
    if (!file) {
      this.prepared = null;
      this.shareStatus.set('error');
      return;
    }
    const year = String(review.year);
    const outcome = await this.shares.shareOrSave(
      file,
      this.language.t('holidays.yearInReview.share.title', { year }),
      this.language.t('holidays.yearInReview.share.text', {
        year,
        count: review.trainings,
      }),
    );
    this.shareStatus.set(outcome === 'saved' ? 'saved' : 'idle');
  }

  private prepare(review: YearInReview): Promise<File | null> {
    const key = `${review.year}:${this.language.lang()}`;
    if (this.prepared?.key !== key) {
      this.prepared = {
        key,
        file: this.shares
          .makeImage(this.shareContent(review), shareFileName(review.year))
          .catch(() => null),
      };
    }
    return this.prepared.file;
  }

  /** The picture's text in the page's language. */
  private shareContent(review: YearInReview): YearShareContent {
    const t = (key: string, params?: TranslationParams) =>
      this.language.t(key, params);
    const upper = (text: string) =>
      text.toLocaleUpperCase(this.language.locale());
    const rows = shareRows(review).map((row) => {
      switch (row) {
        case 'time':
          return {
            label: t('holidays.yearInReview.summary.time'),
            value: review.favouriteTime!.time,
          };
        case 'streak':
          return {
            label: t('holidays.yearInReview.summary.streak'),
            value: t('holidays.yearInReview.summary.weeks', {
              count: review.longestStreakWeeks,
            }),
          };
        case 'trainer':
          return {
            label: t('holidays.yearInReview.summary.trainer'),
            value: review.topTrainer!.name,
          };
        case 'month':
          return {
            label: t('holidays.yearInReview.summary.month'),
            value: this.monthName(review.busiestMonth!.month),
          };
      }
    });
    return {
      kicker: upper(
        t('holidays.yearInReview.share.kicker', { year: String(review.year) }),
      ),
      figure: this.number(review.trainings),
      figureLabel: t('holidays.yearInReview.trainings.label', {
        count: review.trainings,
      }),
      rows: rows.map((row) => ({ ...row, label: upper(row.label) })),
      outro: t('holidays.yearInReview.summary.outro', {
        year: String(review.year + 1),
      }),
      site: new URL(environment.publicSiteUrl).host,
    };
  }

  play(): void {
    this.index.set(0);
    this.shareStatus.set('idle');
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
    if ((event.target as Element | null)?.closest('button')) {
      return;
    }
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
