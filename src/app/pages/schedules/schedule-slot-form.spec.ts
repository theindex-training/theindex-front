import {
  NEW_TRAINING_TIME,
  changedSlotFields,
  createSlotForm,
  fillSlotForm,
  slotFormResult,
  sortTrainingTimes,
} from './schedule-slot-form';
import { SCHEDULE_GYM_KEY, initialGymId, rememberGym } from './schedule-gym';

const MORNING = {
  id: 'tt-morning',
  startTime: '07:10:00',
  endTime: '08:10:00',
};
const SHORT = { id: 'tt-short', startTime: '07:10:00', endTime: '07:40:00' };
const EVENING = {
  id: 'tt-evening',
  startTime: '17:00:00',
  endTime: '18:00:00',
};
const TIMES = [EVENING, MORNING, SHORT];

describe('schedule slot form', () => {
  it('needs a training time and a trainer', () => {
    const form = createSlotForm();
    expect(form.valid).toBe(false);

    form.patchValue({ trainingTimeId: MORNING.id, trainerId: 'tr-1' });

    expect(form.valid).toBe(true);
  });

  it('with a new training time, needs both hours and an end after the start', () => {
    const form = createSlotForm();
    form.patchValue({ trainingTimeId: NEW_TRAINING_TIME, trainerId: 'tr-1' });
    expect(form.errors).toEqual({ startTime: true, endTime: true });

    form.patchValue({ startTime: '12:30', endTime: '12:30' });
    expect(form.errors).toEqual({ endBeforeStart: true });

    form.patchValue({ endTime: '13:30' });
    expect(form.valid).toBe(true);
  });

  it('sends a new training time by its hours, and hours that exist by their id', () => {
    const form = createSlotForm();
    form.patchValue({
      trainingTimeId: NEW_TRAINING_TIME,
      startTime: '12:30',
      endTime: '13:30',
      trainerId: 'tr-1',
    });
    expect(slotFormResult(form, TIMES)).toEqual({
      trainingTime: { trainingTime: { startTime: '12:30', endTime: '13:30' } },
      trainerId: 'tr-1',
      workoutId: null,
    });

    form.patchValue({ startTime: '07:10', endTime: '08:10', workoutId: 'w1' });
    expect(slotFormResult(form, TIMES)).toEqual({
      trainingTime: { trainingTimeId: MORNING.id },
      trainerId: 'tr-1',
      workoutId: 'w1',
    });
  });

  it('fills the form from a slot, and empties it for a new one', () => {
    const form = createSlotForm();
    fillSlotForm(form, {
      trainingTime: EVENING,
      trainer: { id: 'tr-2' },
      workout: { id: 'w9' },
    });
    expect(form.getRawValue()).toEqual({
      trainingTimeId: EVENING.id,
      startTime: '',
      endTime: '',
      trainerId: 'tr-2',
      workoutId: 'w9',
    });

    fillSlotForm(form, null);
    expect(form.getRawValue().trainingTimeId).toBe('');
  });

  it('a change sends only the fields that changed', () => {
    const slot = {
      trainingTime: MORNING,
      trainer: { id: 'tr-old' },
      workout: { id: 'w1' },
    };
    const unchanged = {
      trainingTime: { trainingTimeId: MORNING.id },
      trainerId: 'tr-old',
      workoutId: 'w1',
    };

    expect(changedSlotFields(slot, unchanged, true)).toEqual({});
    expect(
      changedSlotFields(
        slot,
        { ...unchanged, trainingTime: { trainingTimeId: EVENING.id } },
        true,
      ),
    ).toEqual({ trainingTimeId: EVENING.id });
    expect(
      changedSlotFields(
        slot,
        {
          trainingTime: {
            trainingTime: { startTime: '20:00', endTime: '21:00' },
          },
          trainerId: 'tr-new',
          workoutId: null,
        },
        true,
      ),
    ).toEqual({
      trainingTime: { startTime: '20:00', endTime: '21:00' },
      trainerId: 'tr-new',
      workoutId: null,
    });
    // A template has no workout.
    expect(
      changedSlotFields(slot, { ...unchanged, workoutId: null }, false),
    ).toEqual({});
  });

  it('lists training times by start, then end', () => {
    expect(sortTrainingTimes(TIMES).map((t) => t.id)).toEqual([
      SHORT.id,
      MORNING.id,
      EVENING.id,
    ]);
  });
});

describe('schedule gym', () => {
  beforeEach(() => localStorage.clear());

  it('opens the gym in the address, else the one picked last, else the first', () => {
    const ids = ['gym-a', 'gym-b', 'gym-c'];
    expect(initialGymId(ids, null)).toBe('gym-a');

    rememberGym('gym-c');
    expect(localStorage.getItem(SCHEDULE_GYM_KEY)).toBe('gym-c');
    expect(initialGymId(ids, null)).toBe('gym-c');
    expect(initialGymId(ids, 'gym-b')).toBe('gym-b');
    // Gyms that aren't listed (gone, inactive) are skipped.
    expect(initialGymId(ids, 'gym-x')).toBe('gym-c');
    rememberGym('gym-x');
    expect(initialGymId(ids, null)).toBe('gym-a');
    expect(initialGymId([], null)).toBeNull();
  });
});
