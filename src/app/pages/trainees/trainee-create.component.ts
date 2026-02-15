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
import { Router, RouterLink } from '@angular/router';
import {
  GymSubscription,
  GymSubscriptionsService
} from '../../services/gym-subscriptions.service';
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
export class TraineeCreateComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
    nickname: FormControl<string | null>;
    phone: FormControl<string | null>;
    gymSubscriptionId: FormControl<string | null>;
  }>;

  gymSubscriptions: GymSubscription[] = [];
  gymSubscriptionsLoading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly traineesService: TraineesService,
    private readonly gymSubscriptionsService: GymSubscriptionsService,
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
      gymSubscriptionId: this.formBuilder.control<string | null>(null)
    });
  }

  ngOnInit(): void {
    this.gymSubscriptionsService.list().subscribe({
      next: (gymSubscriptions) => {
        this.gymSubscriptions = gymSubscriptions;
        this.gymSubscriptionsLoading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.gymSubscriptions = [];
        this.gymSubscriptionsLoading = false;
        this.changeDetector.detectChanges();
      }
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
      gymSubscriptionId: raw.gymSubscriptionId,
      isActive: true
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
