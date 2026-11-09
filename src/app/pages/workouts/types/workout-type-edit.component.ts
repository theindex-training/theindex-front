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
  SCORE_TYPES,
  WorkoutType,
  WorkoutTypesService,
} from '../../../services/workout-types.service';
import {
  buildWorkoutTypeForm,
  fillWorkoutTypeForm,
  WorkoutTypeForm,
  workoutTypePayload,
} from './workout-type-form';

/**
 * Creates a workout type (`/workouts/types/new`) or edits and deletes one (`/:id/edit`).
 * Built-in types can be renamed and described, but not deleted.
 */
@Component({
  selector: 'app-workout-type-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './workout-type-edit.component.html',
})
export class WorkoutTypeEditComponent implements OnInit {
  readonly form: WorkoutTypeForm;
  readonly scoreTypes = SCORE_TYPES;

  /** Null on the create page. */
  typeId: string | null = null;
  type: WorkoutType | null = null;
  loading = false;
  submitting = false;
  deleting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly typesService: WorkoutTypesService,
    private readonly language: LanguageService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.form = buildWorkoutTypeForm(formBuilder);
  }

  get isNew(): boolean {
    return this.typeId === null;
  }

  ngOnInit(): void {
    this.typeId = this.route.snapshot.paramMap.get('id');
    if (!this.typeId) {
      return;
    }

    this.loading = true;
    this.typesService.getById(this.typeId).subscribe({
      next: (type) => {
        this.type = type;
        fillWorkoutTypeForm(this.form, type);
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.types.errors.load',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  showError(name: keyof WorkoutTypeForm['controls']): boolean {
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
    const payload = workoutTypePayload(this.form);
    const request = this.typeId
      ? this.typesService.update(this.typeId, payload)
      : this.typesService.create(payload);

    request.subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigate(['/workouts/types']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.types.errors.save',
        );
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** Asks first. The API refuses a type that workouts use; its message says so. */
  deleteType(): void {
    if (!this.type || this.submitting || this.deleting) {
      return;
    }
    const question = this.language.t('workouts.types.edit.deleteConfirm', {
      name: this.type.name,
    });
    if (!window.confirm(question)) {
      return;
    }

    this.deleting = true;
    this.errorMessage = null;
    this.typesService.delete(this.type.id).subscribe({
      next: () => {
        this.deleting = false;
        void this.router.navigate(['/workouts/types']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.types.errors.delete',
        );
        this.deleting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
