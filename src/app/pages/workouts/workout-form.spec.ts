import { FormBuilder } from '@angular/forms';
import { Exercise } from '../../services/exercises.service';
import { WorkoutType } from '../../services/workout-types.service';
import { Workout, WorkoutDraft } from '../../services/workouts.service';
import {
  buildItem,
  buildVariant,
  buildWorkoutForm,
  fillFromDraft,
  fillFromWorkout,
  formatClock,
  hasMore,
  itemProblem,
  parseAmount,
  parseClock,
  parseRepScheme,
  pendingNames,
  resolvePending,
  structureFields,
  workoutPayload,
} from './workout-form';

const fb = new FormBuilder();

const item = (over: object = {}) => ({
  ...buildItem(fb).getRawValue(),
  exerciseId: 'e-run',
  ...over,
});

const NO_ITEM = {
  quantity: null,
  quantityMax: null,
  quantityFemale: null,
  maxEffort: false,
  loadKg: null,
  loadFemaleKg: null,
  loadPercent: null,
  slot: null,
  notes: null,
};
const NO_STRUCTURE = {
  rounds: null,
  repScheme: null,
  durationSeconds: null,
  timeCapSeconds: null,
  intervalSeconds: null,
  workSeconds: null,
  restSeconds: null,
  notes: null,
};

const HELEN: Workout = {
  id: 'w1',
  date: '2026-11-09',
  title: 'Helen',
  notes: null,
  summary: {
    blocks: [
      { type: 'paragraph', data: { text: '<b>3 rounds for time:</b>' } },
    ],
  },
  summaryText: '3 rounds for time:',
  parts: [
    {
      id: 'p1',
      title: null,
      workoutTypeId: 't-time',
      workoutType: { id: 't-time', name: 'For time', code: 'FOR_TIME' },
      scoreType: 'TIME',
      variants: [
        {
          ...NO_STRUCTURE,
          level: 'RX',
          rounds: 3,
          timeCapSeconds: 900,
          items: [
            {
              ...NO_ITEM,
              exerciseId: 'e-run',
              exercise: { id: 'e-run', name: 'Run' },
              measure: 'DISTANCE',
              quantity: 400,
            },
            {
              ...NO_ITEM,
              exerciseId: 'e-swing',
              exercise: { id: 'e-swing', name: 'Kettlebell swing' },
              measure: 'REPS',
              quantity: 21,
              loadKg: 24,
              loadFemaleKg: 16,
            },
            {
              ...NO_ITEM,
              exerciseId: 'e-plank',
              exercise: { id: 'e-plank', name: 'Plank' },
              measure: 'TIME',
              quantity: 40,
              maxEffort: true,
              slot: 2,
              notes: 'Strict',
            },
          ],
        },
      ],
    },
  ],
};

describe('workout form: times, schemes and amounts', () => {
  it('reads a time only with a colon', () => {
    expect(parseClock('12:00')).toBe(720);
    expect(parseClock(':40')).toBe(40);
    expect(parseClock(' 1:05 ')).toBe(65);
    expect(parseClock('12')).toBeNull();
    expect(parseClock('1:60')).toBeNull();
    expect(parseClock('0:00')).toBeNull();
    expect(parseClock('abc')).toBeNull();
  });

  it('writes seconds as m:ss', () => {
    expect(formatClock(720)).toBe('12:00');
    expect(formatClock(40)).toBe('0:40');
    expect(formatClock(65)).toBe('1:05');
  });

  it('reads a rep scheme separated by hyphens, spaces or commas', () => {
    expect(parseRepScheme('21-15-9')).toEqual([21, 15, 9]);
    expect(parseRepScheme('5, 3, 1')).toEqual([5, 3, 1]);
    expect(parseRepScheme('5 5 5')).toEqual([5, 5, 5]);
    expect(parseRepScheme('21-0')).toBeNull();
    expect(parseRepScheme('21-x')).toBeNull();
    expect(parseRepScheme('')).toBeNull();
    expect(parseRepScheme(Array(31).fill('1').join('-'))).toBeNull();
  });

  it('reads an amount as a time for TIME and a whole number otherwise', () => {
    expect(parseAmount('0:40', 'TIME')).toBe(40);
    expect(parseAmount('40', 'TIME')).toBeNull();
    expect(parseAmount('400', 'DISTANCE')).toBe(400);
    expect(parseAmount('2.5', 'REPS')).toBeNull();
    expect(parseAmount('0', 'REPS')).toBeNull();
  });
});

describe('itemProblem', () => {
  it('accepts the usual shapes', () => {
    expect(itemProblem(item({ quantity: '21' }), false)).toBeNull();
    expect(itemProblem(item({}), true)).toBeNull();
    expect(itemProblem(item({ maxEffort: true }), false)).toBeNull();
    expect(
      itemProblem(
        item({ measure: 'TIME', quantity: '0:40', maxEffort: true }),
        false,
      ),
    ).toBeNull();
    expect(
      itemProblem(
        item({
          measure: 'CALORIES',
          quantity: '20',
          quantityFemale: '15',
          loadKg: 24,
          loadFemaleKg: 16,
        }),
        false,
      ),
    ).toBeNull();
    expect(
      itemProblem(item({ quantity: '10', quantityMax: '15' }), false),
    ).toBeNull();
  });

  it.each([
    [{ exerciseId: '' }, false, 'exercise'],
    [{ exerciseId: '', pendingName: 'Wall ball' }, false, 'unknownExercise'],
    [{ quantity: 'ten' }, false, 'whole'],
    [{ measure: 'TIME', quantity: '40' }, false, 'time'],
    [{}, false, 'repsRequired'],
    [{ measure: 'DISTANCE' }, true, 'amountRequired'],
    [{ maxEffort: true, quantityMax: '5' }, false, 'rangeNeedsAmount'],
    [{ quantity: '15', quantityMax: '15' }, false, 'range'],
    [{ quantity: '15', quantityMax: 'x' }, false, 'whole'],
    [{ maxEffort: true, quantityFemale: '5' }, false, 'femaleNeedsAmount'],
    [{ quantity: '5', loadFemaleKg: 16 }, false, 'femaleNeedsLoad'],
  ])('%j (scheme: %s) -> %s', (over, hasScheme, problem) => {
    expect(itemProblem(item(over), hasScheme)).toBe(problem);
  });

  it('makes the level invalid while an item has a problem, and follows the rep scheme', () => {
    const variant = buildVariant(fb, 'RX');
    variant.controls.items.at(0).controls.exerciseId.setValue('e-run');
    expect(variant.hasError('items')).toBe(true);

    variant.controls.repScheme.setValue('21-15-9');
    expect(variant.valid).toBe(true);

    variant.controls.repScheme.setValue('21-15-x');
    expect(variant.controls.repScheme.hasError('repScheme')).toBe(true);
    expect(variant.hasError('items')).toBe(true);
  });
});

describe('workout form: filling and sending', () => {
  it('a saved workout goes into the form and comes back as the same content', () => {
    const form = buildWorkoutForm(fb);
    fillFromWorkout(fb, form, HELEN);

    expect(form.valid).toBe(true);
    const variant = form.controls.parts.at(0).controls.variants.at(0);
    expect(variant.getRawValue()).toMatchObject({
      rounds: 3,
      timeCap: '15:00',
      repScheme: '',
    });
    expect(variant.controls.items.at(2).getRawValue()).toMatchObject({
      measure: 'TIME',
      quantity: '0:40',
    });

    expect(workoutPayload(form)).toEqual({
      date: '2026-11-09',
      title: 'Helen',
      notes: null,
      summary: HELEN.summary,
      parts: [
        {
          id: 'p1',
          title: null,
          workoutTypeId: 't-time',
          scoreType: 'TIME',
          variants: [
            {
              ...NO_STRUCTURE,
              level: 'RX',
              rounds: 3,
              timeCapSeconds: 900,
              items: HELEN.parts[0].variants[0].items.map(
                ({ exercise, ...fields }) => {
                  void exercise;
                  return fields;
                },
              ),
            },
          ],
        },
      ],
    });
  });

  it('trims text, sends empty text as null and turns what was typed into numbers', () => {
    const form = buildWorkoutForm(fb, '2026-11-10');
    form.patchValue({
      title: '  Fran ',
      notes: '   ',
      summary: { blocks: [{ type: 'paragraph', data: { text: 'Fran' } }] },
    });
    const part = form.controls.parts.at(0);
    part.patchValue({ workoutTypeId: 't-time', scoreType: 'TIME', title: ' ' });
    const variant = part.controls.variants.at(0);
    variant.patchValue({
      repScheme: ' 21-15-9 ',
      timeCap: '10:00',
      notes: ' Go ',
    });
    variant.controls.items.at(0).patchValue({
      exerciseId: 'e-thruster',
      loadKg: 43,
      notes: ' Unbroken ',
    });

    const payload = workoutPayload(form);

    expect(payload).toMatchObject({
      date: '2026-11-10',
      title: 'Fran',
      notes: null,
      summary: { blocks: [{ type: 'paragraph', data: { text: 'Fran' } }] },
    });
    expect(payload.parts[0]).not.toHaveProperty('id');
    expect(payload.parts[0].title).toBeNull();
    expect(payload.parts[0].variants[0]).toMatchObject({
      repScheme: [21, 15, 9],
      timeCapSeconds: 600,
      durationSeconds: null,
      notes: 'Go',
      items: [
        {
          exerciseId: 'e-thruster',
          quantity: null,
          loadKg: 43,
          notes: 'Unbroken',
        },
      ],
    });
  });

  it('a PDF draft fills the form; unknown movements wait for an exercise', () => {
    const draft: WorkoutDraft = {
      sourceCode: '261114',
      date: '2026-11-14',
      title: null,
      summary: {
        blocks: [
          { type: 'paragraph', data: { text: '<b>AMRAP 12:</b>' } },
          { type: 'paragraph', data: { text: '20/15-cal bike' } },
        ],
      },
      unknownExercises: ['Wall ball'],
      warnings: [],
      parts: [
        {
          title: null,
          typeCode: 'AMRAP',
          workoutTypeId: 't-amrap',
          scoreType: 'ROUNDS_REPS',
          variants: [
            {
              ...NO_STRUCTURE,
              level: 'RX',
              durationSeconds: 720,
              items: [
                {
                  ...NO_ITEM,
                  exerciseId: 'e-bike',
                  exerciseName: 'Bike',
                  measure: 'CALORIES',
                  quantity: 20,
                  quantityFemale: 15,
                },
                {
                  ...NO_ITEM,
                  exerciseId: null,
                  exerciseName: 'Wall ball',
                  measure: 'REPS',
                  quantity: 15,
                },
              ],
            },
          ],
        },
      ],
    };
    const form = buildWorkoutForm(fb, '2026-11-01');
    form.controls.title.setValue('Typed before');

    fillFromDraft(fb, form, draft);

    // The draft has a date and a summary but no title: the typed title stays.
    expect(form.getRawValue()).toMatchObject({
      date: '2026-11-14',
      title: 'Typed before',
      summary: draft.summary,
    });
    expect(pendingNames(form)).toEqual(['Wall ball']);
    expect(form.valid).toBe(false);

    resolvePending(form, 'Wall ball', { id: 'e-wb' } as Exercise);

    expect(pendingNames(form)).toEqual([]);
    expect(form.valid).toBe(true);
    const payload = workoutPayload(form);
    expect(payload.summary).toEqual(draft.summary);
    expect(payload.parts[0].variants.map((v) => v.level)).toEqual(['RX']);
    expect(payload.parts[0].variants[0].items).toMatchObject([
      { exerciseId: 'e-bike', quantity: 20, quantityFemale: 15 },
      { exerciseId: 'e-wb', quantity: 15 },
    ]);
  });

  it('a draft without parts leaves the form’s parts alone', () => {
    const form = buildWorkoutForm(fb, '2026-11-01');

    fillFromDraft(fb, form, {
      sourceCode: null,
      date: null,
      title: null,
      summary: null,
      parts: [],
      unknownExercises: [],
      warnings: ['The RX workout could not be read'],
    });

    expect(form.controls.date.value).toBe('2026-11-01');
    expect(form.controls.summary.value).toBeNull();
    expect(form.controls.parts).toHaveLength(1);
  });

  it('requires a summary with some text', () => {
    const form = buildWorkoutForm(fb, '2026-11-10');
    const summary = form.controls.summary;
    const of = (...texts: string[]) => ({
      blocks: texts.map((text) => ({
        type: 'paragraph' as const,
        data: { text },
      })),
    });

    expect(summary.hasError('required')).toBe(true);
    summary.setValue(of());
    expect(summary.hasError('required')).toBe(true);
    summary.setValue(of('<b> </b>', '<br>', '&nbsp;'));
    expect(summary.hasError('required')).toBe(true);
    summary.setValue(of('<b>AMRAP 12</b>'));
    expect(summary.valid).toBe(true);
  });
});

describe('structureFields and hasMore', () => {
  const type = (code: WorkoutType['code']) => ({ code }) as WorkoutType;

  it('shows the fields the type uses, all of them for a type of the trainers’ own', () => {
    const variant = buildVariant(fb, 'RX');

    expect(structureFields(type('AMRAP'), variant)).toEqual(['duration']);
    expect(structureFields(type('TABATA'), variant)).toEqual([
      'rounds',
      'work',
      'rest',
    ]);
    expect(structureFields(type(null), variant)).toHaveLength(7);
    expect(structureFields(undefined, variant)).toHaveLength(7);
  });

  it('never hides a field that holds a value', () => {
    const variant = buildVariant(fb, 'RX');
    variant.patchValue({ rounds: 3, timeCap: '15:00' });

    expect(structureFields(type('AMRAP'), variant)).toEqual([
      'rounds',
      'duration',
      'timeCap',
    ]);
  });

  it('hasMore tells whether an item’s extra fields hold anything', () => {
    const row = buildItem(fb);
    expect(hasMore(row)).toBe(false);

    row.controls.slot.setValue(2);
    expect(hasMore(row)).toBe(true);
  });
});
