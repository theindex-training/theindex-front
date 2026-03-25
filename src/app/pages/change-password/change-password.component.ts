import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButtonComponent } from '../../components/ui-button/ui-button.component';
import { UiInputComponent } from '../../components/ui-input/ui-input.component';
import { AccountSecurityService } from '../../services/account-security.service';
import { AuthService } from '../../services/auth.service';

const passwordMatchValidator: ValidatorFn = control => {
  const newPassword = (control.get('newPassword')?.value as string | null) ?? '';
  const confirmPassword = (control.get('confirmPassword')?.value as string | null) ?? '';

  if (!newPassword && !confirmPassword) {
    return null;
  }

  return newPassword === confirmPassword ? null : ({ passwordMismatch: true } as ValidationErrors);
};

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiInputComponent, UiButtonComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  isSubmitting = false;
  isLoadingPasswordStatus = true;
  requiresPhone = false;
  successMessage = '';
  errorMessage = '';

  readonly form = this.fb.group(
    {
      currentPassword: ['', [Validators.required, Validators.minLength(8)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
      phone: ['']
    },
    { validators: passwordMatchValidator }
  );

  constructor(
    private readonly authService: AuthService,
    private readonly accountSecurityService: AccountSecurityService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const accountId = this.authService.getAccountId();

    if (!accountId) {
      this.isLoadingPasswordStatus = false;
      return;
    }

    this.accountSecurityService.hasChangedPassword(accountId).subscribe({
      next: hasChangedPassword => {
        this.requiresPhone = !hasChangedPassword;
        this.updatePhoneValidators();
        this.isLoadingPasswordStatus = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.isLoadingPasswordStatus = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  handleSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const accountId = this.authService.getAccountId();

    if (!accountId) {
      this.errorMessage = 'Unable to identify your account. Please sign in again.';
      return;
    }

    const raw = this.form.getRawValue();

    if (!raw.currentPassword || !raw.newPassword || !raw.confirmPassword) {
      return;
    }

    const normalizedPhone = raw.phone?.trim() || null;

    if (this.requiresPhone && !normalizedPhone) {
      this.form.controls.phone.markAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
      phone?: string;
    } = {
      currentPassword: raw.currentPassword,
      newPassword: raw.newPassword,
      confirmPassword: raw.confirmPassword
    };

    if (this.requiresPhone && normalizedPhone) {
      payload.phone = normalizedPhone;
    }

    this.accountSecurityService
      .changePassword(accountId, payload)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.successMessage = 'Password updated successfully.';
          this.form.reset();
          this.changeDetector.detectChanges();
          this.router.navigate([this.getDefaultRoute()]);
        },
        error: (error: unknown) => {
          this.isSubmitting = false;
          this.errorMessage =
            (error as { error?: { message?: string } })?.error?.message ??
            'Unable to update your password right now.';
          this.changeDetector.detectChanges();
        }
      });
  }

  get passwordMismatchError(): boolean {
    return Boolean(this.form.errors?.['passwordMismatch'] && this.form.controls.confirmPassword.touched);
  }

  private updatePhoneValidators(): void {
    if (this.requiresPhone) {
      this.form.controls.phone.setValidators([Validators.required]);
    } else {
      this.form.controls.phone.clearValidators();
    }

    this.form.controls.phone.updateValueAndValidity();
  }

  private getDefaultRoute(): string {
    const role = this.authService.getUserRole();

    if (role === 'TRAINEE') {
      return '/my-trainings';
    }

    return '/home';
  }
}
