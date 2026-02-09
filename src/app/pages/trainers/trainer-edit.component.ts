import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  TrainerProfile,
  TrainersService,
  UpdateTrainerPayload
} from '../../services/trainers.service';

const optionalMinLength = (minLength: number): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }
    return value.trim().length >= minLength ? null : { minlength: true };
  };
};

@Component({
  selector: 'app-trainer-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './trainer-edit.component.html',
  styleUrl: './trainer-edit.component.scss'
})
export class TrainerEditComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
    nickname: FormControl<string | null>;
    isActive: FormControl<boolean>;
  }>;

  trainer: TrainerProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainersService: TrainersService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2)
      ]),
      nickname: this.formBuilder.control<string | null>(null, [optionalMinLength(1)]),
      isActive: this.formBuilder.nonNullable.control(true)
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Trainer ID is missing.';
      this.loading = false;
      return;
    }

    this.trainersService.getById(id).subscribe({
      next: (trainer) => {
        this.trainer = trainer;
        this.form.patchValue({
          name: trainer.name,
          nickname: trainer.nickname,
          isActive: trainer.isActive
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this trainer.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
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
      isActive: raw.isActive
    };

    this.submitting = true;
    this.errorMessage = '';

    this.trainersService.update(this.trainer.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainers']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to update this trainer right now.';
        this.submitting = false;
      }
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
