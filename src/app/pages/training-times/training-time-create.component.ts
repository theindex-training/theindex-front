import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CreateTrainingTimePayload, TrainingTimesService } from '../../services/training-times.service';

@Component({
  selector: 'app-training-time-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './training-time-create.component.html',
  styleUrl: './training-time-create.component.scss'
})
export class TrainingTimeCreateComponent {
  readonly form: FormGroup<{
    startTime: FormControl<string>;
    endTime: FormControl<string>;
  }>;

  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainingTimesService: TrainingTimesService,
    private readonly router: Router
  ) {
    this.form = this.formBuilder.group({
      startTime: this.formBuilder.nonNullable.control('', [Validators.required]),
      endTime: this.formBuilder.nonNullable.control('', [Validators.required])
    });
  }

  handleSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateTrainingTimePayload = {
      startTime: raw.startTime,
      endTime: raw.endTime
    };

    this.submitting = true;
    this.errorMessage = '';

    this.trainingTimesService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/training-times']);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to create this training time right now.';
        this.submitting = false;
      }
    });
  }
}
