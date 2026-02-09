import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
import { Router, RouterLink } from '@angular/router';
import { CreateTraineePayload, TraineesService } from '../../services/trainees.service';

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
  selector: 'app-trainee-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './trainee-create.component.html',
  styleUrl: './trainee-create.component.scss'
})
export class TraineeCreateComponent {
  readonly form: FormGroup<{
    name: FormControl<string>;
    nickname: FormControl<string | null>;
    phone: FormControl<string | null>;
    isActive: FormControl<boolean>;
  }>;

  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly traineesService: TraineesService,
    private readonly router: Router
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2)
      ]),
      nickname: this.formBuilder.control<string | null>(null, [optionalMinLength(1)]),
      phone: this.formBuilder.control<string | null>(null, [optionalMinLength(1)]),
      isActive: this.formBuilder.nonNullable.control(true)
    });
  }

  handleSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateTraineePayload = {
      name: raw.name.trim(),
      nickname: this.normalizeOptional(raw.nickname),
      phone: this.normalizeOptional(raw.phone),
      isActive: raw.isActive
    };

    this.submitting = true;
    this.errorMessage = '';

    this.traineesService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainees']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to create this trainee right now.';
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
