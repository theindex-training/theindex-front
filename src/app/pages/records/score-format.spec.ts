import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { Score } from '../../services/benchmarks.service';
import { clock, ScoreFormat, scoreText, scoringText } from './score-format';

const EMPTY: Score = {
  timeSeconds: null,
  capped: false,
  rounds: null,
  reps: null,
  loadKg: null,
};

describe('score format', () => {
  let format: ScoreFormat;
  let language: LanguageService;

  beforeEach(() => {
    language = TestBed.inject(LanguageService);
    const locale = TestBed.inject(LocaleFormatService);
    format = {
      t: (key, params) => language.t(key, params),
      number: (value) => locale.number(value),
    };
  });

  it('reads seconds as m:ss, or h:mm:ss from an hour', () => {
    expect(clock(266)).toBe('4:26');
    expect(clock(600)).toBe('10:00');
    expect(clock(9)).toBe('0:09');
    expect(clock(3725)).toBe('1:02:05');
  });

  it('writes each score type in words', () => {
    expect(scoreText({ ...EMPTY, timeSeconds: 266 }, 'TIME', format)).toBe(
      '4:26',
    );
    expect(
      scoreText({ ...EMPTY, capped: true, reps: 80 }, 'TIME', format),
    ).toBe('Time cap + 80 reps');
    expect(
      scoreText({ ...EMPTY, rounds: 12, reps: 5 }, 'ROUNDS_REPS', format),
    ).toBe('12 rounds + 5 reps');
    expect(
      scoreText({ ...EMPTY, rounds: 1, reps: 0 }, 'ROUNDS_REPS', format),
    ).toBe('1 round');
    expect(scoreText({ ...EMPTY, reps: 1 }, 'REPS', format)).toBe('1 rep');
    expect(scoreText({ ...EMPTY, loadKg: 102.5 }, 'LOAD', format)).toBe(
      '102.5 kg',
    );
  });

  it('uses the language of the page, its decimal sign included', async () => {
    await new Promise<void>((resolve) =>
      language.use('bg').subscribe(() => resolve()),
    );

    expect(scoreText({ ...EMPTY, loadKg: 102.5 }, 'LOAD', format)).toBe(
      '102,5 кг',
    );
    expect(
      scoreText({ ...EMPTY, rounds: 3, reps: 1 }, 'ROUNDS_REPS', format),
    ).toBe('3 рунда + 1 повторение');
  });

  it('says how it is scored, with the time cap when there is one', () => {
    expect(
      scoringText({ scoreType: 'TIME', timeCapSeconds: 600 }, format.t),
    ).toBe('For time · Time cap 10:00');
    expect(
      scoringText({ scoreType: 'LOAD', timeCapSeconds: null }, format.t),
    ).toBe('Max load (1RM)');
  });
});
