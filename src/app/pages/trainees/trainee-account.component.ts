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
  ProvisionAccountPayload,
  ProvisionedAccount,
  UpdateAccountPayload
} from '../../services/account-provisioning.service';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';
import { displayValue } from '../../utils/display.util';

const accountPasswordValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = (control.get('password')?.value as string | null) ?? '';
  const confirmPassword = (control.get('confirmPassword')?.value as string | null) ?? '';

  if (!password && !confirmPassword) {
    return null;
  }

  if (password.length < 8 || confirmPassword.length < 8) {
    return { passwordLength: true };
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
    password: FormControl<string>;
    confirmPassword: FormControl<string>;
  }>;

  trainee: TraineeProfile | null = null;
  account: ProvisionedAccount | null = null;
  loading = true;
  submitting = false;
  deactivating = false;
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;

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
        password: this.formBuilder.nonNullable.control(''),
        confirmPassword: this.formBuilder.nonNullable.control('')
      },
      { validators: accountPasswordValidator }
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

        if (trainee.accountId) {
          this.loadExistingAccount(trainee.accountId);
        } else {
          this.loading = false;
          this.changeDetector.detectChanges();
        }
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
    this.submitting = true;
    this.errorMessage = '';

    if (this.account) {
      const payload: UpdateAccountPayload = {
        email: raw.email.trim()
      };

      if (raw.password) {
        payload.password = raw.password;
        payload.confirmPassword = raw.confirmPassword;
      }

      this.provisioningService.update(this.account.id, payload).subscribe({
        next: () => {
          this.submitting = false;
          this.router.navigate(['/trainees', this.trainee!.id]);
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            'Unable to update this account right now.';
          this.submitting = false;
        }
      });
      return;
    }

    const payload: ProvisionAccountPayload = {
      email: raw.email.trim(),
      role: 'TRAINEE',
      password: raw.password,
      confirmPassword: raw.confirmPassword
    };

    this.provisioningService
      .provisionForProfile('trainee', this.trainee.id, payload)
      .subscribe({
        next: () => {
          this.submitting = false;
          this.router.navigate(['/trainees', this.trainee!.id]);
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            'Unable to provision an account for this trainee.';
          this.submitting = false;
        }
      });
  }

  deactivateAccount(): void {
    if (!this.account || this.deactivating) {
      return;
    }

    this.deactivating = true;
    this.errorMessage = '';

    this.provisioningService.deactivate(this.account.id).subscribe({
      next: () => {
        this.deactivating = false;
        this.router.navigate(['/trainees', this.trainee!.id]);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to deactivate this account.';
        this.deactivating = false;
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

  get showPasswordLengthError(): boolean {
    return Boolean(
      this.form.touched &&
        this.form.errors?.['passwordLength'] &&
        (this.form.controls.password.touched ||
          this.form.controls.confirmPassword.touched)
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

  get isEditMode(): boolean {
    return Boolean(this.account);
  }

  private loadExistingAccount(accountId: string): void {
    this.provisioningService.getById(accountId).subscribe({
      next: (account) => {
        this.account = account;
        this.form.patchValue({
          email: account?.email ?? '',
          password: '',
          confirmPassword: ''
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }
}
