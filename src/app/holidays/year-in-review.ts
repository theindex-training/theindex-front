import { YearInReview } from '../services/trainees.service';

/**
 * The trainees' year in review (Dec 27 – Jan 10, on their dashboard): a short story of their year
 * at the gym, a slide at a time, from theindex-api's `GET /api/trainees/me/year-in-review`.
 * Pure, so the choice of slides and lines is unit-tested.
 */
export type YearSlide =
  'trainings' | 'time' | 'streak' | 'trainer' | 'month' | 'summary';

/** A streak of one week is no streak: its slide shows from two weeks in a row. */
export const MIN_STREAK_WEEKS = 2;

/** The slides a year has, in order; none for a year without trainings (the card then hides). */
export function yearSlides(review: YearInReview | null): YearSlide[] {
  if (!review || review.trainings < 1) {
    return [];
  }
  const slides: YearSlide[] = ['trainings'];
  if (review.favouriteTime) {
    slides.push('time');
  }
  if (review.longestStreakWeeks >= MIN_STREAK_WEEKS) {
    slides.push('streak');
  }
  if (review.topTrainer) {
    slides.push('trainer');
  }
  if (review.busiestMonth) {
    slides.push('month');
  }
  slides.push('summary');
  return slides;
}

export type TrainingsTier = 'legend' | 'strong' | 'solid' | 'start';

/** The first slide's line, by how many trainings the year had. */
export function trainingsTier(trainings: number): TrainingsTier {
  if (trainings >= 150) {
    return 'legend';
  }
  if (trainings >= 80) {
    return 'strong';
  }
  if (trainings >= 30) {
    return 'solid';
  }
  return 'start';
}

export type TimeOfDay = 'morning' | 'midday' | 'evening';

/** The favourite hour's line: before 10:00 morning, before 17:00 midday, else evening. */
export function timeOfDay(time: string): TimeOfDay {
  if (time < '10:00') {
    return 'morning';
  }
  return time < '17:00' ? 'midday' : 'evening';
}

/** The streak's line: 10 weeks or more is a long one. */
export function streakTier(weeks: number): 'long' | 'short' {
  return weeks >= 10 ? 'long' : 'short';
}
