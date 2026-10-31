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
import { CreateTrainingTimePayload, TrainingTimesService } from '../../services/training-times.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-training-time-create',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './training-time-create.component.html'
})
export class TrainingTimeCreateComponent {
  readonly form: FormGroup<{
    startTime: FormControl<string>;
    endTime: FormControl<string>;
  }>;

  submitting = false;
  errorMessage: UiMessage | null = null;

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
    this.errorMessage = null;

    this.trainingTimesService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/training-times']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'trainingTimes.create.error');
        this.submitting = false;
      }
    });
  }
}
