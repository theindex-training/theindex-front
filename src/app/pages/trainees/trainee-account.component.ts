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
import { TraineeProfile, TraineesService } from '../../services/trainees.service';
import { displayValue } from '../../utils/display.util';

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

@Component({
  selector: 'app-trainee-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './trainee-account.component.html',
  styleUrl: './trainee-account.component.scss'
})
export class TraineeAccountComponent implements OnInit {
  readonly form: FormGroup<{
    email: FormControl<string>;
    status: FormControl<AccountStatus>;
    password: FormControl<string>;
    confirmPassword: FormControl<string>;
  }>;

  trainee: TraineeProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;

  readonly statusOptions: { value: AccountStatus; label: string }[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' }
  ];

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly provisioningService: AccountProvisioningService,
    private readonly traineesService: TraineesService,
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
      this.errorMessage = 'Trainee ID is missing.';
      this.loading = false;
      return;
    }

    this.traineesService.getById(id).subscribe({
      next: (trainee) => {
        this.trainee = trainee;
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
    if (!this.trainee || this.trainee.accountId) {
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
      role: 'TRAINEE',
      password: raw.password,
      confirmPassword: raw.confirmPassword
    };

    this.submitting = true;
    this.errorMessage = '';

    this.provisioningService
      .provisionForProfile('trainee', this.trainee.id, payload)
      .subscribe({
        next: () => {
          this.submitting = false;
          this.router.navigate(['/trainees']);
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            'Unable to provision an account for this trainee.';
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
    return displayValue(this.trainee?.nickname);
  }

  formatPhone(): string {
    return displayValue(this.trainee?.phone);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
