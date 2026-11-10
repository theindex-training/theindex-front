import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Exercise, ExerciseMeasure } from '../../services/exercises.service';
import {
  ScoreType,
  WorkoutType,
  WorkoutTypeCode,
} from '../../services/workout-types.service';
import {
  Workout,
  WorkoutDraft,
  WorkoutItemFields,
  WorkoutLevel,
  WorkoutPayload,
  WorkoutSummary,
  WorkoutVariantFields,
} from '../../services/workouts.service';
import { trimmedLength } from '../../utils/form-validators.util';
import { hasSummaryText } from './workout-summary';

/** Limits from theindex-api's workout DTOs (workouts/dto/workout.dto.ts). */
export const WORKOUT_TITLE_MAX = 120;
export const WORKOUT_NOTES_MAX = 1000;
export const VARIANT_NOTES_MAX = 500;
export const ITEM_NOTES_MAX = 200;
export const MAX_PARTS = 10;
export const MAX_ITEMS = 40;
export const MAX_REP_SCHEME = 30;
export const MAX_QUANTITY = 100_000;
export const MAX_LOAD_KG = 1000;
const MAX_SECONDS = 24 * 60 * 60;

// ---- text <-> values ----

/** "12:00" -> 720, ":40" -> 40. A time always has a colon, so "12" is never guessed at. */
export function parseClock(text: string): number | null {
  const match = /^(\d{0,4}):([0-5]\d)$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const seconds = Number(match[1] || 0) * 60 + Number(match[2]);
  return seconds >= 1 && seconds <= MAX_SECONDS ? seconds : null;
}

/** 720 -> "12:00", 40 -> "0:40". */
export function formatClock(seconds: number): string {
  const rest = seconds % 60;
  return `${Math.floor(seconds / 60)}:${rest < 10 ? '0' : ''}${rest}`;
}

/** "21-15-9" -> [21, 15, 9]; spaces and commas also separate. */
export function parseRepScheme(text: string): number[] | null {
  const parts = text
    .trim()
    .split(/[\s,-]+/)
    .filter(Boolean);
  if (!parts.length || parts.length > MAX_REP_SCHEME) {
    return null;
  }
  const reps = parts.map(Number);
  return reps.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_QUANTITY)
    ? reps
    : null;
}

/** A whole number from 1, as typed. */
function parseWhole(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }
  const value = Number(text.trim());
  return value >= 1 && value <= MAX_QUANTITY ? value : null;
}

/** An amount as typed for the measure: a time for TIME, a whole number otherwise. */
export function parseAmount(
  text: string,
  measure: ExerciseMeasure,
): number | null {
  return measure === 'TIME' ? parseClock(text) : parseWhole(text);
}

export function formatAmount(
  value: number | null,
  measure: ExerciseMeasure,
): string {
  if (value === null) {
    return '';
  }
  return measure === 'TIME' ? formatClock(value) : String(value);
}

const clock: ValidatorFn = (control) => {
  const text = ((control.value as string | null) ?? '').trim();
  return !text || parseClock(text) !== null ? null : { clock: true };
};

const repScheme: ValidatorFn = (control) => {
  const text = ((control.value as string | null) ?? '').trim();
  return !text || parseRepScheme(text) !== null ? null : { repScheme: true };
};

function wholeBetween(min: number, max: number): ValidatorFn {
  return (control) => {
    const value = control.value as number | null;
    if (value === null || value === undefined) {
      return null;
    }
    return Number.isInteger(value) && value >= min && value <= max
      ? null
      : { whole: true };
  };
}

/** Kilograms: more than 0, up to two decimals. */
const load: ValidatorFn = (control) => {
  const value = control.value as number | null;
  if (value === null || value === undefined) {
    return null;
  }
  const ok =
    value > 0 &&
    value <= MAX_LOAD_KG &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
  return ok ? null : { load: true };
};

// ---- the form ----

export type ItemForm = FormGroup<{
  exerciseId: FormControl<string>;
  /** The movement's name in the PDF while it isn't in the catalogue. Not sent. */
  pendingName: FormControl<string>;
  measure: FormControl<ExerciseMeasure>;
  quantity: FormControl<string>;
  quantityMax: FormControl<string>;
  quantityFemale: FormControl<string>;
  maxEffort: FormControl<boolean>;
  loadKg: FormControl<number | null>;
  loadFemaleKg: FormControl<number | null>;
  loadPercent: FormControl<number | null>;
  slot: FormControl<number | null>;
  notes: FormControl<string>;
}>;

export type VariantForm = FormGroup<{
  level: FormControl<WorkoutLevel>;
  rounds: FormControl<number | null>;
  repScheme: FormControl<string>;
  duration: FormControl<string>;
  timeCap: FormControl<string>;
  interval: FormControl<string>;
  work: FormControl<string>;
  rest: FormControl<string>;
  notes: FormControl<string>;
  items: FormArray<ItemForm>;
}>;

export type PartForm = FormGroup<{
  id: FormControl<string | null>;
  title: FormControl<string>;
  workoutTypeId: FormControl<string>;
  scoreType: FormControl<ScoreType>;
  variants: FormArray<VariantForm>;
}>;

export type WorkoutForm = FormGroup<{
  date: FormControl<string>;
  title: FormControl<string>;
  notes: FormControl<string>;
  /** Set from the summary editor when the form is submitted, and by a PDF draft. */
  summary: FormControl<WorkoutSummary | null>;
  parts: FormArray<PartForm>;
}>;

type ItemValue = ReturnType<ItemForm['getRawValue']>;

/**
 * What is wrong with an item, as the name of its message (the form's itemErrors texts), or
 * null. The same rules as theindex-api's `workoutProblems`, plus the formats of what was typed.
 */
export function itemProblem(
  item: ItemValue,
  hasScheme: boolean,
): string | null {
  if (!item.exerciseId) {
    return item.pendingName ? 'unknownExercise' : 'exercise';
  }
  const amount = (text: string) => parseAmount(text, item.measure);
  const typed = (text: string) => text.trim() !== '';
  const format = item.measure === 'TIME' ? 'time' : 'whole';

  if (typed(item.quantity) && amount(item.quantity) === null) {
    return format;
  }
  if (!typed(item.quantity) && !item.maxEffort) {
    if (item.measure !== 'REPS') {
      return 'amountRequired';
    }
    if (!hasScheme) {
      return 'repsRequired';
    }
  }
  if (typed(item.quantityMax)) {
    const max = amount(item.quantityMax);
    if (max === null) {
      return format;
    }
    if (!typed(item.quantity)) {
      return 'rangeNeedsAmount';
    }
    if (max <= amount(item.quantity)!) {
      return 'range';
    }
  }
  if (typed(item.quantityFemale)) {
    if (amount(item.quantityFemale) === null) {
      return format;
    }
    if (!typed(item.quantity)) {
      return 'femaleNeedsAmount';
    }
  }
  if (item.loadFemaleKg !== null && item.loadKg === null) {
    return 'femaleNeedsLoad';
  }
  return null;
}

/** Marks the level invalid while one of its items has a problem (shown under the item). */
const itemsAreSound: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const variant = control as VariantForm;
  const value = variant.getRawValue();
  const hasScheme = parseRepScheme(value.repScheme) !== null;
  return value.items.some((item) => itemProblem(item, hasScheme) !== null)
    ? { items: true }
    : null;
};

export function buildItem(
  fb: FormBuilder,
  measure: ExerciseMeasure = 'REPS',
): ItemForm {
  const nn = fb.nonNullable;
  return fb.group({
    exerciseId: nn.control(''),
    pendingName: nn.control(''),
    measure: nn.control<ExerciseMeasure>(measure),
    quantity: nn.control(''),
    quantityMax: nn.control(''),
    quantityFemale: nn.control(''),
    maxEffort: nn.control(false),
    loadKg: fb.control<number | null>(null, [load]),
    loadFemaleKg: fb.control<number | null>(null, [load]),
    loadPercent: fb.control<number | null>(null, [wholeBetween(1, 200)]),
    slot: fb.control<number | null>(null, [wholeBetween(1, 60)]),
    notes: nn.control('', [trimmedLength(0, ITEM_NOTES_MAX)]),
  });
}

export function buildVariant(
  fb: FormBuilder,
  level: WorkoutLevel,
): VariantForm {
  const nn = fb.nonNullable;
  return fb.group(
    {
      level: nn.control<WorkoutLevel>(level),
      rounds: fb.control<number | null>(null, [wholeBetween(1, 1000)]),
      repScheme: nn.control('', [repScheme]),
      duration: nn.control('', [clock]),
      timeCap: nn.control('', [clock]),
      interval: nn.control('', [clock]),
      work: nn.control('', [clock]),
      rest: nn.control('', [clock]),
      notes: nn.control('', [trimmedLength(0, VARIANT_NOTES_MAX)]),
      items: fb.array<ItemForm>([buildItem(fb)]),
    },
    { validators: [itemsAreSound] },
  );
}

export function buildPart(fb: FormBuilder): PartForm {
  const nn = fb.nonNullable;
  return fb.group({
    id: fb.control<string | null>(null),
    title: nn.control('', [trimmedLength(0, WORKOUT_TITLE_MAX)]),
    workoutTypeId: nn.control('', [Validators.required]),
    scoreType: nn.control<ScoreType>('NONE'),
    variants: fb.array<VariantForm>([buildVariant(fb, 'RX')]),
  });
}

/** The summary needs some text: what the API requires. */
const summaryRequired: ValidatorFn = (control) =>
  hasSummaryText(control.value as WorkoutSummary | null)
    ? null
    : { required: true };

export function buildWorkoutForm(fb: FormBuilder, date = ''): WorkoutForm {
  const nn = fb.nonNullable;
  return fb.group({
    date: nn.control(date, [Validators.required]),
    title: nn.control('', [trimmedLength(0, WORKOUT_TITLE_MAX)]),
    notes: nn.control('', [trimmedLength(0, WORKOUT_NOTES_MAX)]),
    summary: fb.control<WorkoutSummary | null>(null, [summaryRequired]),
    parts: fb.array<PartForm>([buildPart(fb)]),
  });
}

// ---- filling the form ----

type VariantSource = WorkoutVariantFields & {
  items: (Omit<WorkoutItemFields, 'exerciseId'> & {
    exerciseId: string | null;
    exerciseName?: string;
  })[];
};

function fillVariant(fb: FormBuilder, source: VariantSource): VariantForm {
  const variant = buildVariant(fb, source.level);
  const clockOf = (seconds: number | null) =>
    seconds === null ? '' : formatClock(seconds);
  variant.patchValue({
    rounds: source.rounds,
    repScheme: source.repScheme?.join('-') ?? '',
    duration: clockOf(source.durationSeconds),
    timeCap: clockOf(source.timeCapSeconds),
    interval: clockOf(source.intervalSeconds),
    work: clockOf(source.workSeconds),
    rest: clockOf(source.restSeconds),
    notes: source.notes ?? '',
  });
  variant.controls.items.clear();
  for (const item of source.items) {
    const row = buildItem(fb, item.measure);
    row.patchValue({
      exerciseId: item.exerciseId ?? '',
      pendingName: item.exerciseId ? '' : (item.exerciseName ?? ''),
      quantity: formatAmount(item.quantity, item.measure),
      quantityMax: formatAmount(item.quantityMax, item.measure),
      quantityFemale: formatAmount(item.quantityFemale, item.measure),
      maxEffort: item.maxEffort,
      loadKg: item.loadKg,
      loadFemaleKg: item.loadFemaleKg,
      loadPercent: item.loadPercent,
      slot: item.slot,
      notes: item.notes ?? '',
    });
    variant.controls.items.push(row);
  }
  return variant;
}

function fillParts(
  fb: FormBuilder,
  form: WorkoutForm,
  parts: {
    id?: string;
    title: string | null;
    workoutTypeId: string | null;
    scoreType: ScoreType;
    variants: VariantSource[];
  }[],
): void {
  form.controls.parts.clear();
  for (const source of parts) {
    const part = buildPart(fb);
    part.patchValue({
      id: source.id ?? null,
      title: source.title ?? '',
      workoutTypeId: source.workoutTypeId ?? '',
      scoreType: source.scoreType,
    });
    part.controls.variants.clear();
    for (const variant of source.variants) {
      part.controls.variants.push(fillVariant(fb, variant));
    }
    form.controls.parts.push(part);
  }
}

export function fillFromWorkout(
  fb: FormBuilder,
  form: WorkoutForm,
  workout: Workout,
): void {
  form.patchValue({
    date: workout.date,
    title: workout.title ?? '',
    notes: workout.notes ?? '',
    summary: workout.summary,
  });
  fillParts(fb, form, workout.parts);
}

/**
 * Puts a PDF draft into the form. The date, title and summary are taken only where the draft
 * has them; the parts replace what was there. (The page also puts the summary in its editor.)
 */
export function fillFromDraft(
  fb: FormBuilder,
  form: WorkoutForm,
  draft: WorkoutDraft,
): void {
  if (draft.date) {
    form.controls.date.setValue(draft.date);
  }
  if (draft.title) {
    form.controls.title.setValue(draft.title);
  }
  if (draft.summary) {
    form.controls.summary.setValue(draft.summary);
  }
  if (draft.parts.length) {
    fillParts(fb, form, draft.parts);
  }
}

/** Gives every item waiting for `name` the exercise that was just created for it. */
export function resolvePending(
  form: WorkoutForm,
  name: string,
  exercise: Exercise,
): void {
  for (const item of allItems(form)) {
    if (
      !item.controls.exerciseId.value &&
      item.controls.pendingName.value === name
    ) {
      item.patchValue({ exerciseId: exercise.id, pendingName: '' });
    }
  }
}

/** The names from the PDF that still have no exercise, each once, in order. */
export function pendingNames(form: WorkoutForm): string[] {
  const names = allItems(form)
    .filter((item) => !item.controls.exerciseId.value)
    .map((item) => item.controls.pendingName.value)
    .filter(Boolean);
  return [...new Set(names)];
}

function allItems(form: WorkoutForm): ItemForm[] {
  return form.controls.parts.controls.flatMap((part) =>
    part.controls.variants.controls.flatMap((v) => v.controls.items.controls),
  );
}

// ---- what is sent ----

/** Text is trimmed and empty text sent as null; amounts and times become numbers. */
export function workoutPayload(form: WorkoutForm): WorkoutPayload {
  const raw = form.getRawValue();
  const text = (value: string) => value.trim() || null;
  const seconds = (value: string) => (value.trim() ? parseClock(value) : null);

  return {
    date: raw.date,
    title: text(raw.title),
    notes: text(raw.notes),
    summary: raw.summary ?? { blocks: [] },
    parts: raw.parts.map((part) => ({
      ...(part.id ? { id: part.id } : {}),
      title: text(part.title),
      workoutTypeId: part.workoutTypeId,
      scoreType: part.scoreType,
      variants: part.variants.map((variant) => ({
        level: variant.level,
        rounds: variant.rounds,
        repScheme: variant.repScheme.trim()
          ? parseRepScheme(variant.repScheme)
          : null,
        durationSeconds: seconds(variant.duration),
        timeCapSeconds: seconds(variant.timeCap),
        intervalSeconds: seconds(variant.interval),
        workSeconds: seconds(variant.work),
        restSeconds: seconds(variant.rest),
        notes: text(variant.notes),
        items: variant.items.map((item) => {
          const amount = (value: string) =>
            value.trim() ? parseAmount(value, item.measure) : null;
          return {
            exerciseId: item.exerciseId,
            measure: item.measure,
            quantity: amount(item.quantity),
            quantityMax: amount(item.quantityMax),
            quantityFemale: amount(item.quantityFemale),
            maxEffort: item.maxEffort,
            loadKg: item.loadKg,
            loadFemaleKg: item.loadFemaleKg,
            loadPercent: item.loadPercent,
            slot: item.slot,
            notes: text(item.notes),
          };
        }),
      })),
    })),
  };
}

// ---- which structure fields a type uses ----

export type StructureField =
  | 'rounds'
  | 'repScheme'
  | 'duration'
  | 'timeCap'
  | 'interval'
  | 'work'
  | 'rest';

export const STRUCTURE_FIELDS: StructureField[] = [
  'rounds',
  'repScheme',
  'duration',
  'timeCap',
  'interval',
  'work',
  'rest',
];

const FIELDS_BY_TYPE: Record<WorkoutTypeCode, StructureField[]> = {
  FOR_TIME: ['rounds', 'repScheme', 'timeCap', 'rest'],
  AMRAP: ['duration'],
  EMOM: ['interval', 'duration', 'rounds'],
  TABATA: ['rounds', 'work', 'rest'],
  FOR_LOAD: ['rounds', 'repScheme'],
  QUALITY: ['rounds', 'duration'],
};

/**
 * The structure fields to show for a level: the ones its type uses (all of them for a type of
 * the trainers' own), plus any that already holds a value, so nothing filled in is ever hidden.
 */
export function structureFields(
  type: WorkoutType | undefined,
  variant: VariantForm,
): StructureField[] {
  const usual = type?.code ? FIELDS_BY_TYPE[type.code] : STRUCTURE_FIELDS;
  const value = variant.getRawValue();
  return STRUCTURE_FIELDS.filter(
    (field) =>
      usual.includes(field) ||
      (field === 'rounds' ? value.rounds !== null : value[field].trim() !== ''),
  );
}

/** Whether an item's extra fields hold anything (they are then shown opened). */
export function hasMore(item: ItemForm): boolean {
  const value = item.getRawValue();
  return (
    value.maxEffort ||
    value.quantityMax.trim() !== '' ||
    value.quantityFemale.trim() !== '' ||
    value.loadFemaleKg !== null ||
    value.loadPercent !== null ||
    value.slot !== null ||
    value.notes.trim() !== ''
  );
}
