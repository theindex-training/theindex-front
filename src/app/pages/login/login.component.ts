import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LanguageSwitchComponent } from '../../components/language-switch/language-switch.component';
import { UiButtonComponent } from '../../components/ui-button/ui-button.component';
import { UiInputComponent } from '../../components/ui-input/ui-input.component';
import { AccountSecurityService } from '../../services/account-security.service';
import { AuthService } from '../../services/auth.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true,
  imports: [LanguageSwitchComponent, UiMessagePipe, TranslocoPipe, ReactiveFormsModule, UiButtonComponent, UiInputComponent],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);

  authErrorMessage: UiMessage | null = null;
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
    this.authErrorMessage = null;

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
          apiErrorMessage(error, 'auth.login.error');
        this.changeDetector.detectChanges();
      },
    });
  }

  private getDefaultRoute(): string {
    return this.authService.getUserRole() === 'TRAINEE' ? '/my-profile' : '/home';
  }
}
