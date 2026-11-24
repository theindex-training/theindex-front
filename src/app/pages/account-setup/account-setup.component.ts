import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContactFieldsComponent } from '../../components/contact-fields/contact-fields.component';
import {
  contactForm,
  contactValues,
  fillContactForm,
} from '../../components/contact-fields/contact-form';
import { LanguageSwitchComponent } from '../../components/language-switch/language-switch.component';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  AccountSetup,
  AccountSetupService,
  CompleteAccountSetupPayload,
} from '../../services/account-setup.service';
import { AuthService } from '../../services/auth.service';
import {
  NamedOption,
  RegistrationService,
} from '../../services/registration.service';
import { trimmedLength } from '../../utils/form-validators.util';
import { RETURN_URL_PARAM, safeReturnUrl } from '../../utils/return-url.util';
import { PRIVACY_POLICY_PATH } from '../../utils/privacy-policy';

const passwordsMatch: ValidatorFn = (group) => {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return !confirm || password === confirm ? null : { passwordMismatch: true };
};

/**
 * The first-login form (`/account-setup`) of an account an admin created, or of one that never
 * gave consent: the Register form, filled in with what the admin entered, plus a new password while
 * the admin's one is still in place. The shell's `setupGuard` (and the API) keep the person here
 * until it is saved. Nothing asks for a nickname: it is internal to staff.
 */
@Component({
  selector: 'app-account-setup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    LanguageSwitchComponent,
    ContactFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './account-setup.component.html',
  styleUrls: [
    '../login/login.component.scss',
    '../register/register.component.scss',
  ],
})
export class AccountSetupComponent implements OnInit {
  /** The privacy policy the consent checkbox refers to (opened in a new tab, so the form stays). */
  readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
  /**
   * The page the person was on their way to when the login sent them here (`?returnUrl=`), where
   * the saved setup takes them instead of their start page.
   */
  private readonly returnUrl = safeReturnUrl(
    inject(ActivatedRoute).snapshot.queryParamMap.get(RETURN_URL_PARAM),
  );

  readonly contact = contactForm({ phoneRequired: true });
  readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, trimmedLength(2, 100)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.email,
          Validators.maxLength(254),
        ],
      }),
      // Validators only while a new password is asked for (`show`).
      password: new FormControl('', { nonNullable: true }),
      confirmPassword: new FormControl('', { nonNullable: true }),
      contact: this.contact,
      acceptTerms: new FormControl(false, {
        nonNullable: true,
        validators: [Validators.requiredTrue],
      }),
    },
    { validators: passwordsMatch },
  );

  setup: AccountSetup | null = null;
  gyms: NamedOption[] = [];
  gymSubscriptions: NamedOption[] = [];
  loading = true;
  loadError: UiMessage | null = null;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly accountSetup: AccountSetupService,
    private readonly registration: RegistrationService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Without the options the form still works, with no gym or gym subscription to pick.
    this.registration.options().subscribe({
      next: (options) => {
        this.gyms = options.gyms;
        this.gymSubscriptions = options.gymSubscriptions;
        this.changeDetector.detectChanges();
      },
      error: () => undefined,
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    this.accountSetup.get().subscribe({
      next: (setup) => {
        if (!setup.setupRequired) {
          // Already done (e.g. on another device): nothing to fill in. A stored token that still
          // says otherwise would bounce off setupGuard straight back here, so sign in again for a
          // fresh one.
          if (this.authService.isSetupRequired()) {
            this.authService.logout();
            void this.router.navigate(['/login'], {
              queryParams: this.returnUrl
                ? { [RETURN_URL_PARAM]: this.returnUrl }
                : {},
              replaceUrl: true,
            });
            return;
          }
          this.goOn();
          return;
        }
        this.show(setup);
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.loading = false;
        this.loadError = apiErrorMessage(error, 'accountSetup.loadError');
        this.changeDetector.detectChanges();
      },
    });
  }

  get isTrainee(): boolean {
    return this.setup?.profileType === 'trainee';
  }

  get asksPassword(): boolean {
    return this.setup?.passwordChangeRequired === true;
  }

  invalid(name: 'name' | 'email' | 'password' | 'acceptTerms'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  get emailError(): string {
    return this.form.controls.email.hasError('required')
      ? 'register.emailRequired'
      : 'register.emailInvalid';
  }

  get passwordError(): string {
    return this.form.controls.password.hasError('required')
      ? 'register.passwordRequired'
      : 'register.passwordLength';
  }

  /** Translation key of the confirmation's error, or '' when there is none. */
  get confirmError(): string {
    const control = this.form.controls.confirmPassword;
    if (!control.touched) {
      return '';
    }
    if (control.hasError('required')) {
      return 'register.confirmRequired';
    }
    return this.form.hasError('passwordMismatch') ? 'register.mismatch' : '';
  }

  handleSubmit(): void {
    this.errorMessage = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const contact = contactValues(this.contact);
    const payload: CompleteAccountSetupPayload = {
      email: raw.email.trim(),
      name: raw.name.trim(),
      ...(this.asksPassword
        ? { password: raw.password, confirmPassword: raw.confirmPassword }
        : {}),
      phone: contact.phone ?? '',
      ...(this.isTrainee
        ? { gymSubscriptionId: contact.gymSubscriptionId }
        : {}),
      homeGymId: contact.homeGymId,
      instagram: contact.instagram,
      facebook: contact.facebook,
      tiktok: contact.tiktok,
      acceptTerms: raw.acceptTerms,
    };

    this.submitting = true;
    this.accountSetup.complete(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.changeDetector.detectChanges();
        this.goOn();
      },
      error: (error: unknown) => {
        this.submitting = false;
        this.errorMessage = apiErrorMessage(error, 'accountSetup.error');
        this.changeDetector.detectChanges();
      },
    });
  }

  signOut(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  /** On to the page the person was going to, else their start page. */
  private goOn(): void {
    void this.router.navigateByUrl(
      this.returnUrl ?? this.authService.defaultRoute(),
      { replaceUrl: true },
    );
  }

  private show(setup: AccountSetup): void {
    this.setup = setup;
    this.form.controls.name.setValue(setup.name);
    this.form.controls.email.setValue(setup.email ?? '');
    fillContactForm(this.contact, setup);

    const { password, confirmPassword } = this.form.controls;
    if (setup.passwordChangeRequired) {
      password.setValidators([
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(128),
      ]);
      confirmPassword.setValidators([Validators.required]);
    } else {
      password.clearValidators();
      confirmPassword.clearValidators();
    }
    password.updateValueAndValidity();
    confirmPassword.updateValueAndValidity();
  }
}
