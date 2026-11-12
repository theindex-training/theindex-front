import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  CreateExercisePayload,
  Exercise,
} from '../../../services/exercises.service';
import { trimmedLength } from '../../../utils/form-validators.util';
import { youtubeVideoId } from '../../../utils/youtube.util';

/** Limits from theindex-api's exercise DTOs (exercises/dto/exercise-fields.ts). */
export const EXERCISE_NAME_MAX = 80;
export const EXERCISE_ALIASES_MAX = 20;
export const EXERCISE_DESCRIPTION_MAX = 2000;
export const EXERCISE_VIDEO_URL_MAX = 300;

export type ExerciseForm = FormGroup<{
  name: FormControl<string>;
  /** Other spellings, separated by commas. */
  aliases: FormControl<string>;
  isActive: FormControl<boolean>;
  description: FormControl<string>;
  videoUrl: FormControl<string>;
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

/** A link to a YouTube video, up to 300 characters. Empty passes. */
function youtubeLink(control: { value: unknown }) {
  const value = ((control.value as string | null) ?? '').trim();
  if (!value) {
    return null;
  }
  return value.length <= EXERCISE_VIDEO_URL_MAX && youtubeVideoId(value)
    ? null
    : { youtube: true };
}

export function buildExerciseForm(fb: FormBuilder): ExerciseForm {
  const nn = fb.nonNullable;
  return fb.group({
    name: nn.control('', [
      Validators.required,
      trimmedLength(1, EXERCISE_NAME_MAX),
    ]),
    aliases: nn.control('', [aliasList]),
    isActive: nn.control(true),
    description: nn.control('', [trimmedLength(0, EXERCISE_DESCRIPTION_MAX)]),
    videoUrl: nn.control('', [youtubeLink]),
  });
}

export function fillExerciseForm(form: ExerciseForm, exercise: Exercise): void {
  form.setValue({
    name: exercise.name,
    aliases: exercise.aliases.join(', '),
    isActive: exercise.isActive,
    description: exercise.description ?? '',
    videoUrl: exercise.videoUrl ?? '',
  });
}

/** Every field, trimmed, with the aliases as a list; an empty description or link is sent as null. */
export function exercisePayload(form: ExerciseForm): CreateExercisePayload {
  const raw = form.getRawValue();
  return {
    name: raw.name.trim(),
    aliases: splitAliases(raw.aliases),
    isActive: raw.isActive,
    description: raw.description.trim() || null,
    videoUrl: raw.videoUrl.trim() || null,
  };
}
