import {
  ChangeDetectorRef,
  Component,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LanguageSwitchComponent } from '../../components/language-switch/language-switch.component';
import { UiButtonComponent } from '../../components/ui-button/ui-button.component';
import { UiInputComponent } from '../../components/ui-input/ui-input.component';
import { AccountSecurityService } from '../../services/account-security.service';
import { AuthService } from '../../services/auth.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { RETURN_URL_PARAM, safeReturnUrl } from '../../utils/return-url.util';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    LanguageSwitchComponent,
    RouterLink,
    UiMessagePipe,
    TranslocoPipe,
    ReactiveFormsModule,
    UiButtonComponent,
    UiInputComponent,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  /**
   * The page the person was sent here from (`?returnUrl=`, set by the guards and by an expired
   * session), where a successful sign-in takes them instead of their start page.
   */
  private readonly returnUrl = safeReturnUrl(
    inject(ActivatedRoute).snapshot.queryParamMap.get(RETURN_URL_PARAM),
  );

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
        if (this.authService.getUserRole() === 'ADMIN') {
          this.goAfterAdminLogin();
          return;
        }
        this.isSubmitting = false;
        this.changeDetector.detectChanges();
        // Trainees and trainers an admin created an account for (or who never gave consent)
        // fill in the first-login form before anything else.
        // The setup page passes the return address on, so the person still gets there after it.
        if (this.authService.isSetupRequired()) {
          void this.router.navigate(['/account-setup'], {
            queryParams: this.returnUrl
              ? { [RETURN_URL_PARAM]: this.returnUrl }
              : {},
          });
          return;
        }
        void this.router.navigateByUrl(
          this.returnUrl ?? this.authService.defaultRoute(),
        );
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        // 403: the password is right, but no admin has connected the account to a profile yet.
        this.authErrorMessage =
          (error as { status?: number } | null)?.status === 403
            ? i18nMessage('auth.login.notLinked')
            : apiErrorMessage(error, 'auth.login.error');
        this.changeDetector.detectChanges();
      },
    });
  }

  /** Admins have no first-login setup; they are still asked once to replace a seeded password. */
  private goAfterAdminLogin(): void {
    const accountId = this.authService.getAccountId();
    const start = this.returnUrl ?? '/home';
    const go = (url: string) => {
      this.isSubmitting = false;
      this.changeDetector.detectChanges();
      void this.router.navigateByUrl(url);
    };

    if (!accountId) {
      go(start);
      return;
    }

    this.accountSecurityService.hasChangedPassword(accountId).subscribe({
      next: (hasChangedPassword) =>
        go(hasChangedPassword ? start : '/change-password'),
      error: () => go(start),
    });
  }
}
