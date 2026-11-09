import en from '../../../../public/i18n/en.json';
import { WorkoutItem } from '../../services/workouts.service';
import {
  amountText,
  itemLine,
  loadText,
  structurePhrases,
  Translate,
} from './workout-format';

/** The English texts, with {placeholders} filled in (plurals: the "other" form unless 1). */
const t: Translate = (key, params = {}) => {
  let text = (en.workouts.format as Record<string, string>)[key];
  text = text.replace(
    /\{count, plural, one \{# (\w+)\} other \{# (\w+)\}\}/,
    (_, one: string, other: string) =>
      `${String(params['count'])} ${params['count'] === 1 ? one : other}`,
  );
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name]));
};

const item = (over: Partial<WorkoutItem> = {}): WorkoutItem => ({
  exerciseId: 'e1',
  exercise: { id: 'e1', name: 'Run' },
  measure: 'REPS',
  quantity: null,
  quantityMax: null,
  quantityFemale: null,
  maxEffort: false,
  loadKg: null,
  loadFemaleKg: null,
  loadPercent: null,
  slot: null,
  notes: null,
  ...over,
});

const NO_STRUCTURE = {
  level: 'RX' as const,
  rounds: null,
  repScheme: null,
  durationSeconds: null,
  timeCapSeconds: null,
  intervalSeconds: null,
  workSeconds: null,
  restSeconds: null,
  notes: null,
};

describe('workout text', () => {
  it('describes how a level is organised', () => {
    expect(
      structurePhrases({ ...NO_STRUCTURE, rounds: 3, timeCapSeconds: 900 }, t),
    ).toEqual(['3 rounds', 'cap 15:00']);
    expect(structurePhrases({ ...NO_STRUCTURE, rounds: 1 }, t)).toEqual([
      '1 round',
    ]);
    expect(
      structurePhrases({ ...NO_STRUCTURE, repScheme: [21, 15, 9] }, t),
    ).toEqual(['21-15-9']);
    expect(
      structurePhrases(
        { ...NO_STRUCTURE, durationSeconds: 1200, intervalSeconds: 60 },
        t,
      ),
    ).toEqual(['20:00', 'every 1:00']);
    expect(
      structurePhrases(
        { ...NO_STRUCTURE, rounds: 8, workSeconds: 20, restSeconds: 10 },
        t,
      ),
    ).toEqual(['8 rounds', 'work 0:20', 'rest 0:10']);
    expect(structurePhrases(NO_STRUCTURE, t)).toEqual([]);
  });

  it('writes amounts with their unit, range, women’s value and max effort', () => {
    expect(amountText(item({ quantity: 21 }), t)).toBe('21');
    expect(amountText(item({ measure: 'DISTANCE', quantity: 400 }), t)).toBe(
      '400 m',
    );
    expect(amountText(item({ measure: 'TIME', quantity: 40 }), t)).toBe('0:40');
    expect(amountText(item({ quantity: 10, quantityMax: 15 }), t)).toBe(
      '10–15',
    );
    expect(
      amountText(
        item({ measure: 'CALORIES', quantity: 20, quantityFemale: 15 }),
        t,
      ),
    ).toBe('20/15 cal (M/W)');
    expect(amountText(item({ quantity: 12, quantityFemale: 9 }), t)).toBe(
      '12/9 (M/W)',
    );
    expect(amountText(item(), t)).toBe('');
    expect(amountText(item({ maxEffort: true }), t)).toBe('Max');
    expect(
      amountText(item({ measure: 'TIME', quantity: 40, maxEffort: true }), t),
    ).toBe('Max in 0:40');
    expect(
      amountText(
        item({ measure: 'DISTANCE', quantity: 500, maxEffort: true }),
        t,
      ),
    ).toBe('Max of 500 m');
  });

  it('writes loads in kilograms, as a percentage, or both', () => {
    expect(loadText(item(), t)).toBe('');
    expect(loadText(item({ loadKg: 42.5 }), t)).toBe('42.5 kg');
    expect(loadText(item({ loadKg: 24, loadFemaleKg: 16 }), t)).toBe(
      '24/16 kg (M/W)',
    );
    expect(loadText(item({ loadPercent: 80 }), t)).toBe('80%');
    expect(loadText(item({ loadPercent: 80, loadKg: 60 }), t)).toBe(
      '80% · 60 kg',
    );
  });

  it('puts an item on one line', () => {
    expect(itemLine(item({ measure: 'DISTANCE', quantity: 400 }), t)).toBe(
      '400 m Run',
    );
    expect(itemLine(item(), t)).toBe('Run');
    expect(
      itemLine(
        item({
          exercise: { id: 'e2', name: 'Kettlebell swing' },
          quantity: 21,
          loadKg: 24,
          loadFemaleKg: 16,
        }),
        t,
      ),
    ).toBe('21 Kettlebell swing · 24/16 kg (M/W)');
    expect(
      itemLine(
        item({
          measure: 'TIME',
          quantity: 40,
          maxEffort: true,
          slot: 2,
          notes: 'Strict',
        }),
        t,
      ),
    ).toBe('Min 2: Max in 0:40 Run (Strict)');
  });
});
