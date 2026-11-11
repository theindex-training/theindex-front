import { FormBuilder } from '@angular/forms';
import { Exercise } from '../../services/exercises.service';
import { Workout, WorkoutDraft } from '../../services/workouts.service';
import {
  buildWorkoutForm,
  fillFromDraft,
  fillFromWorkout,
  listFromWorkout,
  normalizeSummary,
  workoutPayload,
} from './workout-form';

const fb = new FormBuilder();

const exercise = (id: string, name: string, over: object = {}): Exercise => ({
  id,
  name,
  aliases: [],
  isActive: true,
  description: null,
  videoUrl: null,
  ...over,
});
const RUN = exercise('e-run', 'Run');
const SWING = exercise('e-swing', 'Kettlebell Swing', {
  videoUrl: 'https://www.youtube.com/watch?v=mKDIuUbH94Q',
});

const HELEN: Workout = {
  id: 'w1',
  date: '2026-11-09',
  title: 'Helen',
  summary: '3 rounds for time:\n400-m run\n21 KB swings',
  exercises: [
    { id: 'e-run', name: 'Run', videoUrl: null, isActive: true },
    {
      id: 'e-swing',
      name: 'Kettlebell Swing',
      videoUrl: 'https://www.youtube.com/watch?v=mKDIuUbH94Q',
      isActive: true,
    },
  ],
};

describe('normalizeSummary', () => {
  it('keeps line breaks and cleans what the API cleans', () => {
    expect(
      normalizeSummary(
        '\n\n3 rounds:  \r\n400-m run\r\n\r\n\r\n\r\n12 pull-ups \n\n',
      ),
    ).toBe('3 rounds:\n400-m run\n\n12 pull-ups');
  });
});

describe('workout form', () => {
  it('requires a day and a summary, and caps the name and summary', () => {
    const form = buildWorkoutForm(fb);

    expect(form.controls.date.hasError('required')).toBe(true);
    expect(form.controls.summary.hasError('required')).toBe(true);

    form.controls.summary.setValue(' \n \r\n ');
    expect(form.controls.summary.hasError('required')).toBe(true);
    form.controls.summary.setValue('x'.repeat(3001));
    expect(form.controls.summary.hasError('maxlength')).toBe(true);
    // Trailing spaces don't count: they are not sent.
    form.controls.summary.setValue('x'.repeat(3000) + '   \n ');
    expect(form.controls.summary.valid).toBe(true);

    form.controls.title.setValue('x'.repeat(121));
    expect(form.controls.title.invalid).toBe(true);
  });

  it('a saved workout goes into the form and comes back as the same payload', () => {
    const form = buildWorkoutForm(fb);
    fillFromWorkout(form, HELEN);
    const list = listFromWorkout(HELEN);

    expect(form.valid).toBe(true);
    expect(workoutPayload(form, list)).toEqual({
      date: '2026-11-09',
      title: 'Helen',
      summary: '3 rounds for time:\n400-m run\n21 KB swings',
      exerciseIds: ['e-run', 'e-swing'],
    });
  });

  it('sends an empty name as null and the summary as the API stores it', () => {
    const form = buildWorkoutForm(fb, '2026-11-10');
    form.patchValue({ title: '   ', summary: '  Fran  \r\n21-15-9  \n\n' });

    expect(workoutPayload(form, [])).toEqual({
      date: '2026-11-10',
      title: null,
      summary: 'Fran\n21-15-9',
      exerciseIds: [],
    });
  });

  it('a PDF draft fills the form; known exercises come from the catalogue, the rest wait', () => {
    const draft: WorkoutDraft = {
      sourceCode: '261109',
      date: '2026-11-09',
      title: null,
      summary:
        '3 rounds for time:\n400-m run\n21 KB swings (35/53 lb)\n15 wall balls',
      exercises: [
        { name: 'Run', exerciseId: 'e-run', exerciseName: 'Run' },
        {
          name: 'KB swing',
          exerciseId: 'e-swing',
          exerciseName: 'Kettlebell Swing',
        },
        { name: 'Wall ball', exerciseId: null, exerciseName: null },
        {
          name: 'Kettlebell swing',
          exerciseId: 'e-swing',
          exerciseName: 'Kettlebell Swing',
        },
        { name: 'Box jump', exerciseId: 'e-new', exerciseName: 'Box Jump' },
      ],
      warnings: [],
    };
    const form = buildWorkoutForm(fb, '2026-11-01');
    form.controls.title.setValue('Typed before');

    const list = fillFromDraft(form, draft, [RUN, SWING]);

    // The draft has a date and a summary but no name: the typed name stays.
    expect(form.getRawValue()).toEqual({
      date: '2026-11-09',
      title: 'Typed before',
      summary: draft.summary,
    });
    expect(list).toEqual([
      {
        kind: 'exercise',
        exercise: { id: 'e-run', name: 'Run', videoUrl: null, isActive: true },
      },
      {
        kind: 'exercise',
        exercise: {
          id: 'e-swing',
          name: 'Kettlebell Swing',
          videoUrl: 'https://www.youtube.com/watch?v=mKDIuUbH94Q',
          isActive: true,
        },
      },
      { kind: 'pending', name: 'Wall ball' },
      // One the page's catalogue doesn't have yet: as the API named it.
      {
        kind: 'exercise',
        exercise: {
          id: 'e-new',
          name: 'Box Jump',
          videoUrl: null,
          isActive: true,
        },
      },
    ]);
    // Movements still waiting for an exercise are not sent.
    expect(workoutPayload(form, list).exerciseIds).toEqual([
      'e-run',
      'e-swing',
      'e-new',
    ]);
  });

  it('a draft without a date or summary leaves those fields alone', () => {
    const form = buildWorkoutForm(fb, '2026-11-01');
    form.controls.summary.setValue('Mine');

    const list = fillFromDraft(
      form,
      {
        sourceCode: null,
        date: null,
        title: null,
        summary: '',
        exercises: [],
        warnings: ['The RX workout could not be read'],
      },
      [],
    );

    expect(form.getRawValue()).toEqual({
      date: '2026-11-01',
      title: '',
      summary: 'Mine',
    });
    expect(list).toEqual([]);
  });
});
