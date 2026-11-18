import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  BenchmarkResult,
  BenchmarkScoreType,
  ResultPayload,
} from '../../services/benchmarks.service';
import { trimmedLength } from '../../utils/form-validators.util';

/** Limits from theindex-api's result DTO (benchmarks/dto/benchmark-result.dto.ts). */
export const RESULT_NOTE_MAX = 500;
export const RESULT_MAX_REPS = 100_000;
export const RESULT_MAX_ROUNDS = 10_000;
export const RESULT_MAX_LOAD_KG = 1000;
/** 24 hours, the API's longest time. */
export const RESULT_MAX_SECONDS = 86_400;

export interface ScoreRules {
  scoreType: BenchmarkScoreType;
  timeCapSeconds: number | null;
}

export type ResultForm = FormGroup<{
  /** 'YYYY-MM-DD'. */
  performedOn: FormControl<string>;
  /** TIME: the time as minutes and seconds. */
  minutes: FormControl<number | null>;
  seconds: FormControl<number | null>;
  /** TIME with a time cap: not finished; `reps` are the reps done. */
  capped: FormControl<boolean>;
  rounds: FormControl<number | null>;
  reps: FormControl<number | null>;
  loadKg: FormControl<number | null>;
  scaled: FormControl<boolean>;
  note: FormControl<string>;
}>;

const wholeNumber: ValidatorFn = (control) =>
  control.value === null || Number.isInteger(control.value)
    ? null
    : { wholeNumber: true };

/** kg in steps of 0.5. */
const halfKilo: ValidatorFn = (control) =>
  control.value === null || Number.isInteger((control.value as number) * 2)
    ? null
    : { halfKilo: true };

/** A day that isn't after `today` ('YYYY-MM-DD' strings compare as dates). */
export function notAfter(today: string): ValidatorFn {
  return (control) =>
    control.value && (control.value as string) > today
      ? { future: true }
      : null;
}

/**
 * TIME (not capped): the minutes and seconds make at least a second, and no more than the time
 * cap. Errors go on the form: `time` (missing or zero) and `overCap`.
 */
function timeValidator(rules: ScoreRules): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const form = group as ResultForm;
    if (rules.scoreType !== 'TIME' || form.controls.capped.value) {
      return null;
    }
    const total = timeSecondsOf(form);
    if (total === null || total < 1) {
      return { time: true };
    }
    if (rules.timeCapSeconds !== null && total > rules.timeCapSeconds) {
      return { overCap: true };
    }
    return null;
  };
}

/** The time typed, in seconds, or null when neither part is filled in. */
export function timeSecondsOf(form: ResultForm): number | null {
  const { minutes, seconds } = form.getRawValue();
  if (minutes === null && seconds === null) {
    return null;
  }
  return (minutes ?? 0) * 60 + (seconds ?? 0);
}

export function buildResultForm(fb: FormBuilder, today: string): ResultForm {
  const nn = fb.nonNullable;
  return fb.group({
    performedOn: nn.control(today, [Validators.required, notAfter(today)]),
    minutes: fb.control<number | null>(null, [
      Validators.min(0),
      Validators.max(RESULT_MAX_SECONDS / 60),
      wholeNumber,
    ]),
    seconds: fb.control<number | null>(null, [
      Validators.min(0),
      Validators.max(59),
      wholeNumber,
    ]),
    capped: nn.control(false),
    rounds: fb.control<number | null>(null),
    reps: fb.control<number | null>(null),
    loadKg: fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.5),
      Validators.max(RESULT_MAX_LOAD_KG),
      halfKilo,
    ]),
    scaled: nn.control(false),
    note: nn.control('', [trimmedLength(0, RESULT_NOTE_MAX)]),
  });
}

/**
 * Turns on the fields of the score type (and of a capped result) and off the others, so only
 * they are validated and sent. Call it once the benchmark is known and when `capped` changes.
 */
export function applyScoreRules(form: ResultForm, rules: ScoreRules): void {
  const c = form.controls;
  const capped = rules.scoreType === 'TIME' && c.capped.value;
  const on = new Set<keyof ResultForm['controls']>(
    rules.scoreType === 'TIME'
      ? capped
        ? ['capped', 'reps']
        : rules.timeCapSeconds !== null
          ? ['minutes', 'seconds', 'capped']
          : ['minutes', 'seconds']
      : rules.scoreType === 'ROUNDS_REPS'
        ? ['rounds', 'reps']
        : rules.scoreType === 'REPS'
          ? ['reps']
          : ['loadKg'],
  );
  for (const name of [
    'minutes',
    'seconds',
    'capped',
    'rounds',
    'reps',
    'loadKg',
  ] as const) {
    if (on.has(name)) {
      c[name].enable({ emitEvent: false });
    } else {
      c[name].disable({ emitEvent: false });
    }
  }
  // A heavy lift is never scaled.
  if (rules.scoreType === 'LOAD') {
    c.scaled.setValue(false, { emitEvent: false });
    c.scaled.disable({ emitEvent: false });
  } else {
    c.scaled.enable({ emitEvent: false });
  }

  // Reps are required except as the extra reps of an AMRAP round.
  const count = (max: number, required: boolean) => [
    ...(required ? [Validators.required] : []),
    Validators.min(0),
    Validators.max(max),
    wholeNumber,
  ];
  c.rounds.setValidators(count(RESULT_MAX_ROUNDS, true));
  c.reps.setValidators(
    count(RESULT_MAX_REPS, rules.scoreType !== 'ROUNDS_REPS'),
  );
  form.setValidators(timeValidator(rules));
  for (const control of [c.rounds, c.reps]) {
    control.updateValueAndValidity({ emitEvent: false });
  }
  form.updateValueAndValidity({ emitEvent: false });
}

export function fillFromResult(
  form: ResultForm,
  result: BenchmarkResult,
): void {
  const time = result.timeSeconds;
  form.patchValue({
    performedOn: result.performedOn,
    minutes: time === null ? null : Math.floor(time / 60),
    seconds: time === null ? null : time % 60,
    capped: result.capped,
    rounds: result.rounds,
    reps: result.reps,
    loadKg: result.loadKg,
    scaled: result.scaled,
    note: result.note ?? '',
  });
}

/**
 * The result as sent: every score field, those of other types (or of a finished time, when
 * capped) as null, so an edit replaces the whole score. The note is trimmed; empty is none.
 */
export function resultPayload(
  form: ResultForm,
  rules: ScoreRules,
): ResultPayload {
  const raw = form.getRawValue();
  const capped = rules.scoreType === 'TIME' && raw.capped;
  return {
    performedOn: raw.performedOn,
    scaled: rules.scoreType === 'LOAD' ? false : raw.scaled,
    timeSeconds:
      rules.scoreType === 'TIME' && !capped ? timeSecondsOf(form) : null,
    capped,
    rounds: rules.scoreType === 'ROUNDS_REPS' ? raw.rounds : null,
    reps:
      capped || rules.scoreType === 'REPS'
        ? raw.reps
        : rules.scoreType === 'ROUNDS_REPS'
          ? (raw.reps ?? 0)
          : null,
    loadKg: rules.scoreType === 'LOAD' ? raw.loadKg : null,
    note: raw.note.trim() || null,
  };
}
