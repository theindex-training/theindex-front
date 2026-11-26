import { YearInReview } from '../services/trainees.service';
import {
  streakTier,
  timeOfDay,
  trainingsTier,
  yearSlides,
} from './year-in-review';

const FULL: YearInReview = {
  year: 2026,
  trainings: 96,
  firstTrainingOn: '2026-01-05',
  favouriteTime: { time: '07:00', count: 41 },
  longestStreakWeeks: 12,
  topTrainer: { id: 'tr-1', name: 'Ivan Petrov', count: 50, photoUrl: null },
  busiestMonth: { month: 10, count: 14 },
};

describe('yearSlides', () => {
  it('has every slide for a full year, in order', () => {
    expect(yearSlides(FULL)).toEqual([
      'trainings',
      'time',
      'streak',
      'trainer',
      'month',
      'summary',
    ]);
  });

  it('has none without trainings, or before the year is loaded', () => {
    expect(
      yearSlides({
        ...FULL,
        trainings: 0,
        firstTrainingOn: null,
        favouriteTime: null,
        longestStreakWeeks: 0,
        topTrainer: null,
        busiestMonth: null,
      }),
    ).toEqual([]);
    expect(yearSlides(null)).toEqual([]);
  });

  it('leaves out a one-week streak and what the year lacks', () => {
    expect(
      yearSlides({
        ...FULL,
        trainings: 1,
        favouriteTime: null,
        longestStreakWeeks: 1,
        topTrainer: null,
      }),
    ).toEqual(['trainings', 'month', 'summary']);
    expect(yearSlides({ ...FULL, longestStreakWeeks: 2 })).toContain('streak');
  });
});

describe('the lines', () => {
  it('picks the trainings line by the count', () => {
    expect(trainingsTier(1)).toBe('start');
    expect(trainingsTier(29)).toBe('start');
    expect(trainingsTier(30)).toBe('solid');
    expect(trainingsTier(80)).toBe('strong');
    expect(trainingsTier(150)).toBe('legend');
  });

  it('picks the favourite hour’s line by the time of day', () => {
    expect(timeOfDay('06:30')).toBe('morning');
    expect(timeOfDay('09:59')).toBe('morning');
    expect(timeOfDay('10:00')).toBe('midday');
    expect(timeOfDay('16:30')).toBe('midday');
    expect(timeOfDay('17:00')).toBe('evening');
    expect(timeOfDay('19:30')).toBe('evening');
  });

  it('calls ten weeks or more a long streak', () => {
    expect(streakTier(9)).toBe('short');
    expect(streakTier(10)).toBe('long');
  });
});
