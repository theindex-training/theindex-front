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
import { CreateTrainerPayload, TrainersService } from '../../services/trainers.service';

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
  selector: 'app-trainer-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './trainer-create.component.html',
  styleUrl: './trainer-create.component.scss'
})
export class TrainerCreateComponent {
  readonly form: FormGroup<{
    name: FormControl<string>;
    nickname: FormControl<string | null>;
  }>;

  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainersService: TrainersService,
    private readonly router: Router
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2)
      ]),
      nickname: this.formBuilder.control<string | null>(null, [optionalMinLength(1)])
    });
  }

  handleSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateTrainerPayload = {
      name: raw.name.trim(),
      nickname: this.normalizeOptional(raw.nickname),
      isActive: true
    };

    this.submitting = true;
    this.errorMessage = '';

    this.trainersService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainers']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to create this trainer right now.';
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
