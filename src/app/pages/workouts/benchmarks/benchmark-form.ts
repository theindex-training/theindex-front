import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  Benchmark,
  BenchmarkKind,
  BenchmarkScoreType,
  CreateBenchmarkPayload,
  UpdateBenchmarkPayload,
} from '../../../services/benchmarks.service';
import { trimmedLength } from '../../../utils/form-validators.util';

/** Limits from theindex-api's benchmark DTO (benchmarks/dto/benchmark.dto.ts). */
export const BENCHMARK_NAME_MAX = 80;
export const BENCHMARK_DESCRIPTION_MAX = 3000;
export const BENCHMARK_EXERCISES_MAX = 20;
/** The API's longest time cap is 24 hours. */
export const BENCHMARK_TIME_CAP_MAX_MINUTES = 1440;

/** The score types a benchmark can have (a heavy lift is always LOAD). */
export const BENCHMARK_SCORE_TYPES: BenchmarkScoreType[] = [
  'TIME',
  'ROUNDS_REPS',
  'REPS',
];

export type BenchmarkForm = FormGroup<{
  kind: FormControl<BenchmarkKind>;
  name: FormControl<string>;
  scoreType: FormControl<BenchmarkScoreType>;
  /** TIME only; empty is no time cap. Whole minutes. */
  timeCapMinutes: FormControl<number | null>;
  description: FormControl<string>;
  isActive: FormControl<boolean>;
}>;

/** A benchmark needs a description; a heavy lift may go without. Error on the control. */
function descriptionRule(control: AbstractControl): ValidationErrors | null {
  const form = control.parent as BenchmarkForm | null;
  if (!form || form.controls.kind.value === 'LIFT') {
    return null;
  }
  return ((control.value as string | null) ?? '').trim()
    ? null
    : { required: true };
}

const wholeMinutes = (control: AbstractControl) =>
  control.value === null || Number.isInteger(control.value)
    ? null
    : { wholeNumber: true };

export function buildBenchmarkForm(fb: FormBuilder): BenchmarkForm {
  const nn = fb.nonNullable;
  return fb.group({
    kind: nn.control<BenchmarkKind>('BENCHMARK'),
    name: nn.control('', [
      Validators.required,
      trimmedLength(1, BENCHMARK_NAME_MAX),
    ]),
    scoreType: nn.control<BenchmarkScoreType>('TIME'),
    timeCapMinutes: fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(BENCHMARK_TIME_CAP_MAX_MINUTES),
      wholeMinutes,
    ]),
    description: nn.control('', [
      descriptionRule,
      trimmedLength(0, BENCHMARK_DESCRIPTION_MAX),
    ]),
    isActive: nn.control(true),
  });
}

/** The time cap only goes with TIME; the description rule depends on the kind. */
export function applyKindRules(form: BenchmarkForm): void {
  const { kind, scoreType, timeCapMinutes, description } = form.controls;
  if (kind.value === 'BENCHMARK' && scoreType.value === 'TIME') {
    timeCapMinutes.enable({ emitEvent: false });
  } else {
    timeCapMinutes.disable({ emitEvent: false });
  }
  description.updateValueAndValidity({ emitEvent: false });
}

export function fillBenchmarkForm(
  form: BenchmarkForm,
  benchmark: Benchmark,
): void {
  form.setValue({
    kind: benchmark.kind,
    name: benchmark.name,
    scoreType: benchmark.kind === 'LIFT' ? 'TIME' : benchmark.scoreType,
    timeCapMinutes:
      benchmark.timeCapSeconds === null
        ? null
        : Math.round(benchmark.timeCapSeconds / 60),
    description: benchmark.description,
    isActive: benchmark.isActive,
  });
  applyKindRules(form);
}

/**
 * The fields as the API takes them: a heavy lift sends no score type (always LOAD) or time cap;
 * a benchmark sends its time cap (null for none, and always null unless TIME).
 */
function fields(form: BenchmarkForm, exerciseIds: string[]) {
  const raw = form.getRawValue();
  const lift = raw.kind === 'LIFT';
  return {
    name: raw.name.trim(),
    ...(lift
      ? {}
      : {
          scoreType: raw.scoreType,
          timeCapSeconds:
            raw.scoreType === 'TIME' && raw.timeCapMinutes
              ? raw.timeCapMinutes * 60
              : null,
        }),
    description: raw.description.trim(),
    exerciseIds,
    isActive: raw.isActive,
  };
}

export function createBenchmarkPayload(
  form: BenchmarkForm,
  exerciseIds: string[],
): CreateBenchmarkPayload {
  return { kind: form.getRawValue().kind, ...fields(form, exerciseIds) };
}

/** Everything but the kind, which never changes. */
export function updateBenchmarkPayload(
  form: BenchmarkForm,
  exerciseIds: string[],
): UpdateBenchmarkPayload {
  return fields(form, exerciseIds);
}
