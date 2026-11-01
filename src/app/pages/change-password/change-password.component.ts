import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButtonComponent } from '../../components/ui-button/ui-button.component';
import { UiInputComponent } from '../../components/ui-input/ui-input.component';
import { AccountSecurityService } from '../../services/account-security.service';
import { AuthService } from '../../services/auth.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';

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
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, ReactiveFormsModule, UiInputComponent, UiButtonComponent, PageHeaderComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  isSubmitting = false;
  isLoadingPasswordStatus = true;
  requiresPhone = false;
  successMessage: UiMessage | null = null;
  errorMessage: UiMessage | null = null;

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
    this.errorMessage = null;
    this.successMessage = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const accountId = this.authService.getAccountId();

    if (!accountId) {
      this.errorMessage = i18nMessage('auth.changePassword.noAccount');
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
          this.successMessage = i18nMessage('auth.changePassword.success');
          this.form.reset();
          this.changeDetector.detectChanges();
          this.router.navigate([this.getDefaultRoute()]);
        },
        error: (error: unknown) => {
          this.isSubmitting = false;
          this.errorMessage =
            apiErrorMessage(error, 'auth.changePassword.error');
          this.changeDetector.detectChanges();
        }
      });
  }

  /** Translation key of the error, or '' when there is none. */
  get currentPasswordError(): string {
    const control = this.form.controls.currentPassword;
    if (!control.touched) {
      return '';
    }
    if (control.hasError('required')) {
      return 'auth.changePassword.currentRequired';
    }
    return control.hasError('minlength') ? 'auth.changePassword.currentLength' : '';
  }

  /** Translation key of the error, or '' when there is none. */
  get newPasswordError(): string {
    const control = this.form.controls.newPassword;
    if (!control.touched) {
      return '';
    }
    if (control.hasError('required')) {
      return 'auth.changePassword.newRequired';
    }
    return control.hasError('minlength') ? 'auth.changePassword.newLength' : '';
  }

  /** Translation key of the error, or '' when there is none. */
  get confirmPasswordError(): string {
    const control = this.form.controls.confirmPassword;
    if (!control.touched) {
      return '';
    }
    if (control.hasError('required')) {
      return 'auth.changePassword.repeat';
    }
    return this.form.hasError('passwordMismatch') ? 'auth.changePassword.mismatch' : '';
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
      return '/my-profile';
    }

    return '/home';
  }
}
