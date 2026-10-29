import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { CreateTrainerPayload, TrainersService } from '../../services/trainers.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { trimmedLength } from '../../utils/form-validators.util';

@Component({
  selector: 'app-trainer-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './trainer-create.component.html'
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
        trimmedLength(2, 100)
      ]),
      nickname: this.formBuilder.control<string | null>(null, [trimmedLength(1, 50)])
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
