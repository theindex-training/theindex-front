import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  TrainingTime,
  TrainingTimesService,
  UpdateTrainingTimePayload
} from '../../services/training-times.service';

@Component({
  selector: 'app-training-time-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './training-time-edit.component.html',
  styleUrl: './training-time-edit.component.scss'
})
export class TrainingTimeEditComponent implements OnInit {
  readonly form: FormGroup<{
    startTime: FormControl<string>;
    endTime: FormControl<string>;
  }>;

  trainingTime: TrainingTime | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainingTimesService: TrainingTimesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.form = this.formBuilder.group({
      startTime: this.formBuilder.nonNullable.control('', [Validators.required]),
      endTime: this.formBuilder.nonNullable.control('', [Validators.required])
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Training time ID is missing.';
      this.loading = false;
      return;
    }

    this.trainingTimesService.getById(id).subscribe({
      next: (trainingTime) => {
        this.trainingTime = trainingTime;
        this.form.patchValue({
          startTime: trainingTime.startTime,
          endTime: trainingTime.endTime
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load this training time.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  handleSubmit(): void {
    if (!this.trainingTime) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateTrainingTimePayload = {
      startTime: raw.startTime,
      endTime: raw.endTime
    };

    this.submitting = true;
    this.errorMessage = '';

    this.trainingTimesService.update(this.trainingTime.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/training-times']);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to update this training time right now.';
        this.submitting = false;
      }
    });
  }
}
