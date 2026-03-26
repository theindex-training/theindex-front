import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButtonComponent } from '../../components/ui-button/ui-button.component';
import { UiInputComponent } from '../../components/ui-input/ui-input.component';
import { AccountSecurityService } from '../../services/account-security.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiButtonComponent, UiInputComponent],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);

  authErrorMessage = '';
  isSubmitting = false;

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(3)]],
  });

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly accountSecurityService: AccountSecurityService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  handleLogin(): void {
    this.authErrorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    if (!email || !password) {
      return;
    }

    this.isSubmitting = true;

    this.authService.login(email, password).subscribe({
      next: () => {
        const accountId = this.authService.getAccountId();

        if (!accountId) {
          this.isSubmitting = false;
          this.changeDetector.detectChanges();
          this.router.navigate([this.getDefaultRoute()]);
          return;
        }

        this.accountSecurityService.hasChangedPassword(accountId).subscribe({
          next: hasChangedPassword => {
            this.isSubmitting = false;
            this.changeDetector.detectChanges();
            this.router.navigate([hasChangedPassword ? this.getDefaultRoute() : '/change-password']);
          },
          error: () => {
            this.isSubmitting = false;
            this.changeDetector.detectChanges();
            this.router.navigate([this.getDefaultRoute()]);
          },
        });
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.authErrorMessage =
          (error as { error?: { message?: string } })?.error?.message ??
          'Unable to sign in with those credentials.';
        this.changeDetector.detectChanges();
      },
    });
  }

  private getDefaultRoute(): string {
    return this.authService.getUserRole() === 'TRAINEE' ? '/my-profile' : '/home';
  }
}
