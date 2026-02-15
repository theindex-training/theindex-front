import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CreateGymLocationPayload,
  GymLocationsService,
} from '../../services/gym-locations.service';

@Component({
  selector: 'app-gym-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './gym-create.component.html',
  styleUrl: './gym-create.component.scss',
})
export class GymCreateComponent {
  readonly form: FormGroup<{
    name: FormControl<string>;
    address: FormControl<string | null>;
  }>;

  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly gymsService: GymLocationsService,
    private readonly router: Router,
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2),
      ]),
      address: this.formBuilder.control<string | null>(null),
    });
  }

  handleSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateGymLocationPayload = {
      name: raw.name.trim(),
      address: this.normalizeOptional(raw.address),
    };

    this.submitting = true;
    this.errorMessage = '';

    this.gymsService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gyms']);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to create this gym right now.';
        this.submitting = false;
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
