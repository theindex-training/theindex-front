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
  GymSubscription,
  GymSubscriptionsService
} from '../../services/gym-subscriptions.service';
import {
  TraineeProfile,
  TraineesService,
  UpdateTraineePayload
} from '../../services/trainees.service';

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
  selector: 'app-trainee-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './trainee-edit.component.html',
  styleUrl: './trainee-edit.component.scss'
})
export class TraineeEditComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
    nickname: FormControl<string | null>;
    phone: FormControl<string | null>;
    gymSubscriptionId: FormControl<string | null>;
    isActive: FormControl<boolean>;
  }>;

  trainee: TraineeProfile | null = null;
  gymSubscriptions: GymSubscription[] = [];
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly traineesService: TraineesService,
    private readonly gymSubscriptionsService: GymSubscriptionsService,
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
      phone: this.formBuilder.control<string | null>(null, [optionalMinLength(1)]),
      gymSubscriptionId: this.formBuilder.control<string | null>(null),
      isActive: this.formBuilder.nonNullable.control(true)
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Trainee ID is missing.';
      this.loading = false;
      return;
    }

    this.gymSubscriptionsService.list(true).subscribe({
      next: (gymSubscriptions) => {
        this.gymSubscriptions = gymSubscriptions;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.gymSubscriptions = [];
        this.changeDetector.detectChanges();
      }
    });

    this.traineesService.getById(id).subscribe({
      next: (trainee) => {
        this.trainee = trainee;
        this.form.patchValue({
          name: trainee.name,
          nickname: trainee.nickname,
          phone: trainee.phone,
          gymSubscriptionId: trainee.gymSubscriptionId,
          isActive: trainee.isActive
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this trainee.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  handleSubmit(): void {
    if (!this.trainee) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateTraineePayload = {
      name: raw.name.trim(),
      nickname: this.normalizeOptional(raw.nickname),
      phone: this.normalizeOptional(raw.phone),
      gymSubscriptionId: raw.gymSubscriptionId,
      isActive: raw.isActive
    };

    this.submitting = true;
    this.errorMessage = '';

    this.traineesService.update(this.trainee.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainees']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to update this trainee right now.';
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
