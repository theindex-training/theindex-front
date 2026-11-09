import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  CreateWorkoutTypePayload,
  ScoreType,
  WorkoutType,
} from '../../../services/workout-types.service';
import { trimmedLength } from '../../../utils/form-validators.util';

/** Limits from theindex-api's workout type DTO (workout-types/dto/create-workout-type.dto.ts). */
export const WORKOUT_TYPE_NAME_MAX = 60;
export const WORKOUT_TYPE_DESCRIPTION_MAX = 500;

export type WorkoutTypeForm = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
  scoreType: FormControl<ScoreType>;
}>;

export function buildWorkoutTypeForm(fb: FormBuilder): WorkoutTypeForm {
  const nn = fb.nonNullable;
  return fb.group({
    name: nn.control('', [
      Validators.required,
      trimmedLength(1, WORKOUT_TYPE_NAME_MAX),
    ]),
    description: nn.control('', [
      trimmedLength(0, WORKOUT_TYPE_DESCRIPTION_MAX),
    ]),
    scoreType: nn.control<ScoreType>('NONE'),
  });
}

export function fillWorkoutTypeForm(
  form: WorkoutTypeForm,
  type: WorkoutType,
): void {
  form.setValue({
    name: type.name,
    description: type.description ?? '',
    scoreType: type.scoreType,
  });
}

/** Every field, trimmed; an empty description is sent as "", which removes it. */
export function workoutTypePayload(
  form: WorkoutTypeForm,
): Required<CreateWorkoutTypePayload> {
  const raw = form.getRawValue();
  return {
    name: raw.name.trim(),
    description: raw.description.trim(),
    scoreType: raw.scoreType,
  };
}
