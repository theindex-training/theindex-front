import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin, merge, of } from 'rxjs';
import { ChipComponent } from '../../../components/chip/chip.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { EnumLabelPipe } from '../../../i18n/enum-label.pipe';
import { LanguageService } from '../../../i18n/language.service';
import {
  apiErrorMessage,
  i18nMessage,
  UiMessage,
} from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import {
  Benchmark,
  BenchmarksService,
} from '../../../services/benchmarks.service';
import {
  Exercise,
  ExercisesService,
} from '../../../services/exercises.service';
import {
  applyKindRules,
  BENCHMARK_DESCRIPTION_MAX,
  BENCHMARK_EXERCISES_MAX,
  BENCHMARK_NAME_MAX,
  BENCHMARK_SCORE_TYPES,
  BenchmarkForm,
  buildBenchmarkForm,
  createBenchmarkPayload,
  fillBenchmarkForm,
  updateBenchmarkPayload,
} from './benchmark-form';

/** An exercise on the list: the catalogue's, or the saved benchmark's own (maybe inactive). */
type Listed = Pick<Exercise, 'id' | 'name' | 'isActive'>;

/**
 * Creates a benchmark or heavy lift (`/workouts/benchmarks/new`) or edits and deletes one
 * (`/:id/edit`). A benchmark has a score type, an optional time cap (for time), a description
 * and an ordered list of exercises; a heavy lift has one exercise. The kind is chosen once.
 */
@Component({
  selector: 'app-benchmark-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
    ChipComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './benchmark-edit.component.html',
  styleUrl: './benchmark-edit.component.scss',
})
export class BenchmarkEditComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly form: BenchmarkForm;
  readonly scoreTypes = BENCHMARK_SCORE_TYPES;
  readonly limits = {
    name: BENCHMARK_NAME_MAX,
    description: BENCHMARK_DESCRIPTION_MAX,
    exercises: BENCHMARK_EXERCISES_MAX,
  };

  benchmarkId: string | null = null;
  benchmark: Benchmark | null = null;
  catalogue: Exercise[] = [];
  listed: Listed[] = [];
  toAdd = '';
  /** "Pick at least one exercise" once a save was tried without. */
  exercisesTouched = false;
  loading = true;
  submitting = false;
  deleting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly benchmarksService: BenchmarksService,
    private readonly exercisesService: ExercisesService,
    private readonly language: LanguageService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.form = buildBenchmarkForm(formBuilder);
    applyKindRules(this.form);
  }

  get isNew(): boolean {
    return this.benchmarkId === null;
  }

  get isLift(): boolean {
    return this.form.controls.kind.value === 'LIFT';
  }

  get busy(): boolean {
    return this.submitting || this.deleting;
  }

  /** Active exercises not on the list yet. */
  get addable(): Exercise[] {
    const listed = new Set(this.listed.map((e) => e.id));
    return this.catalogue.filter((e) => e.isActive && !listed.has(e.id));
  }

  /** A lift's one exercise: the active ones, plus its own if it became inactive. */
  get liftChoices(): Listed[] {
    const own = this.listed[0];
    const active = this.catalogue.filter((e) => e.isActive);
    return own && !active.some((e) => e.id === own.id)
      ? [own, ...active]
      : active;
  }

  get exercisesError(): boolean {
    return this.exercisesTouched && !this.listed.length;
  }

  ngOnInit(): void {
    this.benchmarkId = this.route.snapshot.paramMap.get('id');
    const { kind, scoreType } = this.form.controls;
    merge(kind.valueChanges, scoreType.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // A lift has one exercise: switching keeps only the first.
        if (this.isLift) {
          this.listed = this.listed.slice(0, 1);
        }
        applyKindRules(this.form);
      });

    forkJoin({
      exercises: this.exercisesService.list(),
      benchmark: this.benchmarkId
        ? this.benchmarksService.getById(this.benchmarkId)
        : of(null),
    }).subscribe({
      next: ({ exercises, benchmark }) => {
        this.catalogue = exercises;
        if (benchmark) {
          this.benchmark = benchmark;
          fillBenchmarkForm(this.form, benchmark);
          // The API keeps the score type of one with results.
          if (benchmark.resultCount > 0) {
            this.form.controls.scoreType.disable({ emitEvent: false });
          }
          this.listed = benchmark.exercises.map((e) => ({
            id: e.id,
            name: e.name,
            isActive: e.isActive,
          }));
        }
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.benchmarks.errors.load',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  showError(name: keyof BenchmarkForm['controls']): boolean {
    const control = this.form.controls[name];
    return control.enabled && control.touched && control.invalid;
  }

  addExercise(): void {
    const exercise = this.catalogue.find((e) => e.id === this.toAdd);
    if (!exercise || this.listed.length >= BENCHMARK_EXERCISES_MAX) {
      return;
    }
    this.listed = [...this.listed, exercise];
    this.toAdd = '';
  }

  /** The lift's exercise, from its select. */
  setLiftExercise(id: string): void {
    const exercise = this.liftChoices.find((e) => e.id === id);
    this.listed = exercise ? [exercise] : [];
  }

  move(index: number, step: -1 | 1): void {
    const target = index + step;
    if (target < 0 || target >= this.listed.length) {
      return;
    }
    const next = [...this.listed];
    [next[index], next[target]] = [next[target], next[index]];
    this.listed = next;
  }

  removeAt(index: number): void {
    this.listed = this.listed.filter((_, i) => i !== index);
  }

  handleSubmit(): void {
    if (this.busy) {
      return;
    }
    this.exercisesTouched = true;
    if (this.form.invalid || !this.listed.length) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    const ids = this.listed.map((e) => e.id);
    const request = this.benchmarkId
      ? this.benchmarksService.update(
          this.benchmarkId,
          updateBenchmarkPayload(this.form, ids),
        )
      : this.benchmarksService.create(createBenchmarkPayload(this.form, ids));

    request.subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigate(['/workouts/benchmarks']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.benchmarks.errors.save',
        );
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** Asks first. One with results can't be deleted; the page says so without asking the API. */
  deleteBenchmark(): void {
    if (!this.benchmark || this.busy) {
      return;
    }
    if (this.benchmark.resultCount > 0) {
      this.errorMessage = i18nMessage('workouts.benchmarks.edit.hasResults', {
        count: this.benchmark.resultCount,
      });
      return;
    }
    const question = this.language.t('workouts.benchmarks.edit.deleteConfirm', {
      name: this.benchmark.name,
    });
    if (!window.confirm(question)) {
      return;
    }

    this.deleting = true;
    this.errorMessage = null;
    this.benchmarksService.delete(this.benchmark.id).subscribe({
      next: () => {
        this.deleting = false;
        void this.router.navigate(['/workouts/benchmarks']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.benchmarks.errors.delete',
        );
        this.deleting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
