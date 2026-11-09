import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  CreateExercisePayload,
  Exercise,
  ExerciseMeasure,
  ExerciseModality,
} from '../../../services/exercises.service';
import { trimmedLength } from '../../../utils/form-validators.util';

/** Limits from theindex-api's exercise DTOs (exercises/dto/exercise-fields.ts). */
export const EXERCISE_NAME_MAX = 80;
export const EXERCISE_ALIASES_MAX = 20;

export type ExerciseForm = FormGroup<{
  name: FormControl<string>;
  /** Other spellings, separated by commas. */
  aliases: FormControl<string>;
  modality: FormControl<ExerciseModality>;
  defaultMeasure: FormControl<ExerciseMeasure>;
  isActive: FormControl<boolean>;
}>;

/** "KB swing,  American swing ," -> ["KB swing", "American swing"]. */
export function splitAliases(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((alias) => alias.trim())
    .filter(Boolean);
}

/** Up to 20 aliases of up to 80 characters each. */
function aliasList(control: { value: unknown }) {
  const aliases = splitAliases((control.value as string | null) ?? '');
  return aliases.length <= EXERCISE_ALIASES_MAX &&
    aliases.every((alias) => alias.length <= EXERCISE_NAME_MAX)
    ? null
    : { aliases: true };
}

export function buildExerciseForm(fb: FormBuilder): ExerciseForm {
  const nn = fb.nonNullable;
  return fb.group({
    name: nn.control('', [
      Validators.required,
      trimmedLength(1, EXERCISE_NAME_MAX),
    ]),
    aliases: nn.control('', [aliasList]),
    modality: nn.control<ExerciseModality>('WEIGHTLIFTING'),
    defaultMeasure: nn.control<ExerciseMeasure>('REPS'),
    isActive: nn.control(true),
  });
}

export function fillExerciseForm(form: ExerciseForm, exercise: Exercise): void {
  form.setValue({
    name: exercise.name,
    aliases: exercise.aliases.join(', '),
    modality: exercise.modality,
    defaultMeasure: exercise.defaultMeasure,
    isActive: exercise.isActive,
  });
}

/** Every field, with the name trimmed and the aliases as a list. */
export function exercisePayload(form: ExerciseForm): CreateExercisePayload {
  const raw = form.getRawValue();
  return {
    name: raw.name.trim(),
    aliases: splitAliases(raw.aliases),
    modality: raw.modality,
    defaultMeasure: raw.defaultMeasure,
    isActive: raw.isActive,
  };
}
