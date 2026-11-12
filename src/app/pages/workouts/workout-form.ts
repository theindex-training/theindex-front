import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Exercise } from '../../services/exercises.service';
import {
  Workout,
  WorkoutDraft,
  WorkoutExercise,
  WorkoutPayload,
} from '../../services/workouts.service';
import { trimmedLength } from '../../utils/form-validators.util';

/** Limits from theindex-api's workout DTO (workouts/dto/workout.dto.ts). */
export const WORKOUT_TITLE_MAX = 120;
export const WORKOUT_SUMMARY_MAX = 3000;
export const WORKOUT_EXERCISES_MAX = 40;

export type WorkoutForm = FormGroup<{
  date: FormControl<string>;
  title: FormControl<string>;
  summary: FormControl<string>;
}>;

/**
 * An entry of the workout's exercise list: a catalogue exercise, or a movement a PDF named that
 * the catalogue doesn't have yet (the trainer creates it, links it to an exercise, or removes it).
 */
export type ListedExercise =
  | { kind: 'exercise'; exercise: WorkoutExercise }
  | { kind: 'pending'; name: string };

/**
 * The summary as the API stores it: "\r\n" as "\n", no spaces at line ends, at most one empty
 * line in a row, no empty lines around the text (theindex-api's DTO does the same).
 */
export function normalizeSummary(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Required, and at most 3000 characters as stored. */
function summaryRule(control: AbstractControl): ValidationErrors | null {
  const text = normalizeSummary((control.value as string | null) ?? '');
  if (!text) {
    return { required: true };
  }
  return text.length > WORKOUT_SUMMARY_MAX ? { maxlength: true } : null;
}

export function buildWorkoutForm(fb: FormBuilder, date = ''): WorkoutForm {
  const nn = fb.nonNullable;
  return fb.group({
    date: nn.control(date, [Validators.required]),
    title: nn.control('', [trimmedLength(0, WORKOUT_TITLE_MAX)]),
    summary: nn.control('', [summaryRule]),
  });
}

export function fillFromWorkout(form: WorkoutForm, workout: Workout): void {
  form.setValue({
    date: workout.date,
    title: workout.title ?? '',
    summary: workout.summary,
  });
}

/** The page's list for a saved workout. */
export function listFromWorkout(workout: Workout): ListedExercise[] {
  return workout.exercises.map((exercise) => ({ kind: 'exercise', exercise }));
}

/**
 * Puts a PDF draft into the form: the date, title and summary where the draft has them. Returns
 * the draft's exercises as the list (catalogue ones as the catalogue has them, each once).
 */
export function fillFromDraft(
  form: WorkoutForm,
  draft: WorkoutDraft,
  catalogue: Exercise[],
): ListedExercise[] {
  if (draft.date) {
    form.controls.date.setValue(draft.date);
  }
  if (draft.title) {
    form.controls.title.setValue(draft.title);
  }
  if (draft.summary) {
    form.controls.summary.setValue(draft.summary);
  }
  const list: ListedExercise[] = [];
  for (const entry of draft.exercises) {
    if (!entry.exerciseId) {
      list.push({ kind: 'pending', name: entry.name });
      continue;
    }
    if (
      list.some(
        (e) => e.kind === 'exercise' && e.exercise.id === entry.exerciseId,
      )
    ) {
      continue;
    }
    const known = catalogue.find((e) => e.id === entry.exerciseId);
    list.push({
      kind: 'exercise',
      exercise: known
        ? listedFrom(known)
        : {
            id: entry.exerciseId,
            name: entry.exerciseName ?? entry.name,
            videoUrl: null,
            isActive: true,
          },
    });
  }
  return list;
}

/** A catalogue exercise as the list holds it. */
export function listedFrom(exercise: Exercise): WorkoutExercise {
  return {
    id: exercise.id,
    name: exercise.name,
    videoUrl: exercise.videoUrl,
    isActive: exercise.isActive,
  };
}

/** What is sent: text trimmed (an empty name as null), the summary normalized, the ids in order. */
export function workoutPayload(
  form: WorkoutForm,
  list: ListedExercise[],
): WorkoutPayload {
  const raw = form.getRawValue();
  return {
    date: raw.date,
    title: raw.title.trim() || null,
    summary: normalizeSummary(raw.summary),
    exerciseIds: list.flatMap((entry) =>
      entry.kind === 'exercise' ? [entry.exercise.id] : [],
    ),
  };
}
