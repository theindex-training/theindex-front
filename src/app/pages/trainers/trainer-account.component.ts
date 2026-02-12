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
  AccountProvisioningService,
  AccountStatus,
  ProvisionAccountPayload
} from '../../services/account-provisioning.service';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

const matchPasswordsValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password')?.value as string | null;
  const confirmPassword = control.get('confirmPassword')?.value as string | null;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordsMismatch: true };
};

import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainer-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './trainer-account.component.html',
  styleUrl: './trainer-account.component.scss'
})
export class TrainerAccountComponent implements OnInit {
  readonly form: FormGroup<{
    email: FormControl<string>;
    status: FormControl<AccountStatus>;
    password: FormControl<string>;
    confirmPassword: FormControl<string>;
  }>;

  trainer: TrainerProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  readonly statusOptions: { value: AccountStatus; label: string }[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' }
  ];

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly provisioningService: AccountProvisioningService,
    private readonly trainersService: TrainersService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.form = this.formBuilder.group(
      {
        email: this.formBuilder.nonNullable.control('', [
          Validators.required,
          Validators.email
        ]),
        status: this.formBuilder.nonNullable.control<AccountStatus>('ACTIVE'),
        password: this.formBuilder.nonNullable.control('', [
          Validators.required,
          Validators.minLength(8)
        ]),
        confirmPassword: this.formBuilder.nonNullable.control('', [
          Validators.required,
          Validators.minLength(8)
        ])
      },
      { validators: matchPasswordsValidator }
    );
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
    if (!this.trainer || this.trainer.accountId) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ProvisionAccountPayload = {
      email: raw.email.trim(),
      status: raw.status,
      role: 'TRAINER',
      password: raw.password,
      confirmPassword: raw.confirmPassword
    };

    this.submitting = true;
    this.errorMessage = '';

    this.provisioningService
      .provisionForProfile('trainer', this.trainer.id, payload)
      .subscribe({
        next: () => {
          this.submitting = false;
          this.router.navigate(['/trainers']);
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            'Unable to provision an account for this trainer.';
          this.submitting = false;
        }
      });
  }

  get showPasswordMismatch(): boolean {
    return Boolean(
      this.form.touched &&
        this.form.errors?.['passwordsMismatch'] &&
        this.form.controls.confirmPassword.touched
    );
  }

  formatNickname(): string {
    return displayValue(this.trainer?.nickname);
  }
}
