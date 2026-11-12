import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  SlotChanges,
  SlotTrainingTimePayload,
} from '../../services/schedules.service';
import { TrainingTime } from '../../services/training-times.service';
import { formatTimeWithoutSeconds } from '../../utils/time-display';

/** The training-time option that asks for hours: a time the list doesn't have yet. */
export const NEW_TRAINING_TIME = 'new';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type SlotForm = FormGroup<{
  /** A training time id, or NEW_TRAINING_TIME. */
  trainingTimeId: FormControl<string>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
  trainerId: FormControl<string>;
  /** '' for none. */
  workoutId: FormControl<string>;
}>;

/** What the slot form gives the page: the API's fields, ready to send. */
export interface SlotFormResult {
  trainingTime: SlotTrainingTimePayload;
  trainerId: string;
  workoutId: string | null;
}

/** A slot as the form edits it (a template slot or a week slot). */
export interface EditableSlot {
  trainingTime: TrainingTime;
  trainer: { id: string };
  workout?: { id: string } | null;
}

/** With a new training time, its hours: both HH:mm, the end after the start. */
function newTimeValidator(group: AbstractControl): ValidationErrors | null {
  const { trainingTimeId, startTime, endTime } = (
    group as SlotForm
  ).getRawValue();
  if (trainingTimeId !== NEW_TRAINING_TIME) {
    return null;
  }
  const errors: ValidationErrors = {};
  if (!TIME.test(startTime)) errors['startTime'] = true;
  if (!TIME.test(endTime)) errors['endTime'] = true;
  if (!errors['startTime'] && !errors['endTime'] && endTime <= startTime) {
    errors['endBeforeStart'] = true;
  }
  return Object.keys(errors).length ? errors : null;
}

export function createSlotForm(): SlotForm {
  return new FormGroup(
    {
      trainingTimeId: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      startTime: new FormControl('', { nonNullable: true }),
      endTime: new FormControl('', { nonNullable: true }),
      trainerId: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      workoutId: new FormControl('', { nonNullable: true }),
    },
    { validators: newTimeValidator },
  );
}

/** Puts a slot into the form; with none, empties it for a new slot. */
export function fillSlotForm(form: SlotForm, slot: EditableSlot | null): void {
  form.reset({
    trainingTimeId: slot?.trainingTime.id ?? '',
    startTime: '',
    endTime: '',
    trainerId: slot?.trainer.id ?? '',
    workoutId: slot?.workout?.id ?? '',
  });
}

/** Training times in the order a day reads: by start, then end. */
export function sortTrainingTimes(times: TrainingTime[]): TrainingTime[] {
  const key = (t: TrainingTime) =>
    `${formatTimeWithoutSeconds(t.startTime)}-${formatTimeWithoutSeconds(t.endTime)}`;
  return [...times].sort((a, b) => key(a).localeCompare(key(b)));
}

/** The training time that already has these hours, if any. */
export function matchingTrainingTime(
  times: TrainingTime[],
  startTime: string,
  endTime: string,
): TrainingTime | undefined {
  return times.find(
    (t) =>
      formatTimeWithoutSeconds(t.startTime) === startTime &&
      formatTimeWithoutSeconds(t.endTime) === endTime,
  );
}

/**
 * The form's value for the API. Hours that an existing training time already has use it, so a
 * new one is created only for hours the list doesn't have.
 */
export function slotFormResult(
  form: SlotForm,
  times: TrainingTime[],
): SlotFormResult {
  const value = form.getRawValue();
  let trainingTime: SlotTrainingTimePayload;
  if (value.trainingTimeId === NEW_TRAINING_TIME) {
    const existing = matchingTrainingTime(
      times,
      value.startTime,
      value.endTime,
    );
    trainingTime = existing
      ? { trainingTimeId: existing.id }
      : {
          trainingTime: { startTime: value.startTime, endTime: value.endTime },
        };
  } else {
    trainingTime = { trainingTimeId: value.trainingTimeId };
  }
  return {
    trainingTime,
    trainerId: value.trainerId,
    workoutId: value.workoutId || null,
  };
}

/**
 * The fields of an edited slot that changed, for a PATCH. An unchanged trainer is left out, so a
 * slot can keep a trainer who has since become inactive.
 */
export function changedSlotFields(
  slot: EditableSlot,
  result: SlotFormResult,
  withWorkout: boolean,
): SlotChanges {
  const changes: SlotChanges = {};
  if (
    !('trainingTimeId' in result.trainingTime) ||
    result.trainingTime.trainingTimeId !== slot.trainingTime.id
  ) {
    Object.assign(changes, result.trainingTime);
  }
  if (result.trainerId !== slot.trainer.id) {
    changes.trainerId = result.trainerId;
  }
  if (withWorkout && result.workoutId !== (slot.workout?.id ?? null)) {
    changes.workoutId = result.workoutId;
  }
  return changes;
}
