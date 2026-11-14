import { HomeGymFieldComponent } from '../../components/home-gym-field/home-gym-field.component';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TrainerProfile,
  TrainersService,
  UpdateTrainerPayload,
} from '../../services/trainers.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { trimmedLength } from '../../utils/form-validators.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import {
  recordLoadError,
  rejectDeleted,
} from '../../utils/deleted-record.util';

@Component({
  selector: 'app-trainer-edit',
  standalone: true,
  imports: [
    HomeGymFieldComponent,
    UiMessagePipe,
    TranslocoPipe,
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './trainer-edit.component.html',
})
export class TrainerEditComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
    nickname: FormControl<string | null>;
    primaryGymId: FormControl<string>;
  }>;

  trainer: TrainerProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainersService: TrainersService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        trimmedLength(2, 100),
      ]),
      nickname: this.formBuilder.control<string | null>(null, [
        trimmedLength(1, 50),
      ]),
      primaryGymId: this.formBuilder.nonNullable.control(''),
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('trainers.errors.missingId');
      this.loading = false;
      return;
    }

    this.trainersService
      .getById(id)
      .pipe(rejectDeleted())
      .subscribe({
        next: (trainer) => {
          this.trainer = trainer;
          this.form.patchValue({
            name: trainer.name,
            nickname: trainer.nickname,
            primaryGymId: trainer.primaryGymId ?? '',
          });
          this.loading = false;
          this.changeDetector.detectChanges();
        },
        error: (error) => {
          this.errorMessage = recordLoadError(
            error,
            'trainers.errors.notFound',
            'trainers.errors.load',
          );
          this.loading = false;
          this.changeDetector.detectChanges();
        },
      });
  }

  handleSubmit(): void {
    if (!this.trainer) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateTrainerPayload = {
      name: raw.name.trim(),
      nickname: this.normalizeOptional(raw.nickname),
      primaryGymId: raw.primaryGymId || null,
    };

    this.submitting = true;
    this.errorMessage = null;

    this.trainersService.update(this.trainer.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainers']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'trainers.edit.error');
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  private normalizeOptional(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
}
