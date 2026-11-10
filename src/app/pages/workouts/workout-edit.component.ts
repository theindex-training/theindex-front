import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { LanguageService } from '../../i18n/language.service';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  Exercise,
  EXERCISE_MODALITIES,
  ExerciseMeasure,
  ExerciseModality,
  ExercisesService,
} from '../../services/exercises.service';
import {
  SCORE_TYPES,
  WorkoutType,
  WorkoutTypesService,
} from '../../services/workout-types.service';
import { Workout, WorkoutsService } from '../../services/workouts.service';
import {
  buildWorkoutForm,
  fillFromDraft,
  fillFromWorkout,
  PartForm,
  pendingNames,
  resolvePending,
  VariantForm,
  WorkoutForm,
  workoutPayload,
} from './workout-form';
import { SummaryEditorComponent } from './summary-editor.component';
import { WorkoutVariantComponent } from './workout-variant.component';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Creates a workout (`/workouts/new`, optionally `?date=YYYY-MM-DD`) or edits and deletes one
 * (`/workouts/:id/edit`): its summary (the text people read) and its RX workout (one part with
 * its RX level). A lesson-plan PDF can fill both; nothing is saved until the form is submitted,
 * and movements the catalogue doesn't have yet are created here first.
 */
@Component({
  selector: 'app-workout-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
    WorkoutVariantComponent,
    SummaryEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './workout-edit.component.html',
  styleUrl: './workout-edit.component.scss',
})
export class WorkoutEditComponent implements OnInit {
  readonly form: WorkoutForm;

  @ViewChild(SummaryEditorComponent)
  private readonly summaryEditor?: SummaryEditorComponent;
  readonly scoreTypes = SCORE_TYPES;
  readonly modalities = EXERCISE_MODALITIES;

  /** Null on the create page. */
  workoutId: string | null = null;
  workout: Workout | null = null;
  exercises: Exercise[] = [];
  types: WorkoutType[] = [];

  loading = true;
  loadFailed = false;
  submitting = false;
  deleting = false;
  /** Set by a submit attempt: every problem is shown from then on. */
  submitted = false;
  errorMessage: UiMessage | null = null;

  importing = false;
  importError: UiMessage | null = null;
  /** What the PDF import could not read (the API's words). */
  importWarnings: string[] = [];
  importedFrom: string | null = null;

  /** The modality chosen for each movement the PDF named that isn't in the catalogue. */
  pendingModality: Record<string, ExerciseModality> = {};
  creatingExercise: string | null = null;
  createExerciseError: UiMessage | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly workoutsService: WorkoutsService,
    private readonly exercisesService: ExercisesService,
    private readonly typesService: WorkoutTypesService,
    private readonly language: LanguageService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    const date = this.route.snapshot.queryParamMap.get('date') ?? '';
    this.form = buildWorkoutForm(
      formBuilder,
      DATE_PATTERN.test(date) ? date : '',
    );
  }

  get isNew(): boolean {
    return this.workoutId === null;
  }

  get parts(): PartForm[] {
    return this.form.controls.parts.controls;
  }

  get pending(): string[] {
    return pendingNames(this.form);
  }

  ngOnInit(): void {
    this.workoutId = this.route.snapshot.paramMap.get('id');
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.errorMessage = null;

    forkJoin({
      exercises: this.exercisesService.list(),
      types: this.typesService.list(),
      ...(this.workoutId
        ? { workout: this.workoutsService.getById(this.workoutId) }
        : {}),
    }).subscribe({
      next: (loaded) => {
        this.exercises = loaded.exercises;
        this.types = loaded.types;
        const workout = (loaded as { workout?: Workout }).workout;
        if (workout) {
          this.workout = workout;
          fillFromWorkout(this.formBuilder, this.form, workout);
        } else {
          this.applyTypeDefault(this.parts[0], this.types[0]);
        }
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'workouts.form.loadError');
        this.loadFailed = true;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  typeOf(part: PartForm): WorkoutType | undefined {
    return this.types.find((t) => t.id === part.controls.workoutTypeId.value);
  }

  /** Choosing a type sets the score it usually has; the score stays editable. */
  typeChosen(part: PartForm): void {
    const type = this.typeOf(part);
    if (type) {
      part.controls.scoreType.setValue(type.scoreType);
    }
  }

  private applyTypeDefault(
    part: PartForm,
    type: WorkoutType | undefined,
  ): void {
    if (type && !part.controls.workoutTypeId.value) {
      part.patchValue({ workoutTypeId: type.id, scoreType: type.scoreType });
    }
  }

  showError(control: { touched: boolean; invalid: boolean }): boolean {
    return (control.touched || this.submitted) && control.invalid;
  }

  // ---- what the page shows ----

  /** The part the page shows and edits: the first. */
  get part(): PartForm {
    return this.parts[0];
  }

  /** The level the page shows and edits: RX, which every part has. */
  get rx(): VariantForm {
    const variants = this.part.controls.variants.controls;
    return variants.find((v) => v.controls.level.value === 'RX') ?? variants[0];
  }

  /**
   * Parts after the first and other levels than RX, which the API keeps but this page doesn't
   * show (a workout saved before the page showed RX only). Saving keeps them.
   */
  get hiddenSections(): number {
    return this.parts.reduce(
      (count, part, index) =>
        count +
        (index === 0
          ? part.controls.variants.length - 1
          : part.controls.variants.length),
      0,
    );
  }

  get summaryInvalid(): boolean {
    return this.showError(this.form.controls.summary);
  }

  // ---- PDF import ----

  importPdf(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Let the same file be chosen again after a fix.
    input.value = '';
    if (!file || this.importing || this.submitting || this.deleting) {
      return;
    }

    this.importing = true;
    this.importError = null;
    this.importWarnings = [];
    this.createExerciseError = null;

    this.workoutsService.importPdf(file).subscribe({
      next: (draft) => {
        fillFromDraft(this.formBuilder, this.form, draft);
        if (draft.summary) {
          void this.summaryEditor?.load(draft.summary);
        }
        for (const part of this.parts) {
          // A draft part without a type (the built-in one is missing) falls back to the first.
          this.applyTypeDefault(part, this.types[0]);
        }
        this.importWarnings = draft.warnings;
        this.importedFrom = file.name;
        this.submitted = false;
        this.importing = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.importError = apiErrorMessage(error, 'workouts.import.error');
        this.importing = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  modalityFor(name: string): ExerciseModality {
    return this.pendingModality[name] ?? 'GYMNASTICS';
  }

  setModality(name: string, event: Event): void {
    this.pendingModality[name] = (event.target as HTMLSelectElement)
      .value as ExerciseModality;
  }

  /** Adds a movement the PDF named to the catalogue and gives it to the items waiting for it. */
  createPending(name: string): void {
    if (this.creatingExercise) {
      return;
    }
    this.creatingExercise = name;
    this.createExerciseError = null;

    this.exercisesService
      .create({
        name,
        modality: this.modalityFor(name),
        defaultMeasure: this.measureOfPending(name),
      })
      .subscribe({
        next: (exercise) => {
          this.exercises = [...this.exercises, exercise].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          resolvePending(this.form, name, exercise);
          this.creatingExercise = null;
          this.changeDetector.detectChanges();
        },
        error: (error) => {
          this.createExerciseError = apiErrorMessage(
            error,
            'workouts.import.createExerciseError',
          );
          this.creatingExercise = null;
          this.changeDetector.detectChanges();
        },
      });
  }

  /** What the PDF counted the movement in, where it first appears. */
  private measureOfPending(name: string): ExerciseMeasure {
    for (const part of this.parts) {
      for (const variant of part.controls.variants.controls) {
        for (const item of variant.controls.items.controls) {
          if (item.controls.pendingName.value === name) {
            return item.controls.measure.value;
          }
        }
      }
    }
    return 'REPS';
  }

  // ---- save and delete ----

  async handleSubmit(): Promise<void> {
    // While a PDF is being read the form still holds what was there before: saving it would
    // leave the page and drop the import.
    if (this.submitting || this.deleting || this.importing) {
      return;
    }
    this.submitted = true;
    this.submitting = true;
    this.errorMessage = null;
    // The summary lives in Editor.js until now.
    const summary = await this.summaryEditor?.save().catch(() => null);
    this.form.controls.summary.setValue(summary ?? null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = i18nMessage('workouts.form.invalid');
      this.submitting = false;
      this.changeDetector.detectChanges();
      return;
    }

    const payload = workoutPayload(this.form);
    const request = this.workoutId
      ? this.workoutsService.update(this.workoutId, payload)
      : this.workoutsService.create(payload);

    request.subscribe({
      next: (workout) => {
        this.submitting = false;
        void this.router.navigate(['/workouts'], {
          queryParams: { week: workout.date },
        });
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'workouts.form.saveError');
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  deleteWorkout(): void {
    if (!this.workout || this.submitting || this.deleting || this.importing) {
      return;
    }
    if (!window.confirm(this.language.t('workouts.form.deleteConfirm'))) {
      return;
    }

    const week = this.workout.date;
    this.deleting = true;
    this.errorMessage = null;
    this.workoutsService.delete(this.workout.id).subscribe({
      next: () => {
        this.deleting = false;
        void this.router.navigate(['/workouts'], { queryParams: { week } });
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'workouts.form.deleteError');
        this.deleting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
