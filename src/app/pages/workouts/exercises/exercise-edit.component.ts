import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { EnumLabelPipe } from '../../../i18n/enum-label.pipe';
import { LanguageService } from '../../../i18n/language.service';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import {
  Exercise,
  EXERCISE_MEASURES,
  EXERCISE_MODALITIES,
  ExercisesService,
} from '../../../services/exercises.service';
import {
  buildExerciseForm,
  ExerciseForm,
  exercisePayload,
  fillExerciseForm,
} from './exercise-form';

/** Creates an exercise (`/workouts/exercises/new`) or edits and deletes one (`/:id/edit`). */
@Component({
  selector: 'app-exercise-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './exercise-edit.component.html',
})
export class ExerciseEditComponent implements OnInit {
  readonly form: ExerciseForm;
  readonly modalities = EXERCISE_MODALITIES;
  readonly measures = EXERCISE_MEASURES;

  /** Null on the create page. */
  exerciseId: string | null = null;
  exercise: Exercise | null = null;
  loading = false;
  submitting = false;
  deleting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly exercisesService: ExercisesService,
    private readonly language: LanguageService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.form = buildExerciseForm(formBuilder);
  }

  get isNew(): boolean {
    return this.exerciseId === null;
  }

  ngOnInit(): void {
    this.exerciseId = this.route.snapshot.paramMap.get('id');
    if (!this.exerciseId) {
      return;
    }

    this.loading = true;
    this.exercisesService.getById(this.exerciseId).subscribe({
      next: (exercise) => {
        this.exercise = exercise;
        fillExerciseForm(this.form, exercise);
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.exercises.errors.load',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  showError(name: keyof ExerciseForm['controls']): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  handleSubmit(): void {
    if (this.submitting || this.deleting) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    const payload = exercisePayload(this.form);
    const request = this.exerciseId
      ? this.exercisesService.update(this.exerciseId, payload)
      : this.exercisesService.create(payload);

    request.subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigate(['/workouts/exercises']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.exercises.errors.save',
        );
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** Asks first. The API refuses an exercise that workouts use; its message says so. */
  deleteExercise(): void {
    if (!this.exercise || this.submitting || this.deleting) {
      return;
    }
    const question = this.language.t('workouts.exercises.edit.deleteConfirm', {
      name: this.exercise.name,
    });
    if (!window.confirm(question)) {
      return;
    }

    this.deleting = true;
    this.errorMessage = null;
    this.exercisesService.delete(this.exercise.id).subscribe({
      next: () => {
        this.deleting = false;
        void this.router.navigate(['/workouts/exercises']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.exercises.errors.delete',
        );
        this.deleting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
