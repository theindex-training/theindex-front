import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContactFieldsComponent } from '../../components/contact-fields/contact-fields.component';
import {
  contactForm,
  contactValues,
} from '../../components/contact-fields/contact-form';
import { LanguageSwitchComponent } from '../../components/language-switch/language-switch.component';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  NamedOption,
  RegisterPayload,
  RegistrationService,
} from '../../services/registration.service';
import { trimmedLength } from '../../utils/form-validators.util';

const passwordsMatch: ValidatorFn = (group) => {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return !confirm || password === confirm ? null : { passwordMismatch: true };
};

/**
 * Public sign-up (`/register`): anyone creates their own account, which can sign in once an admin
 * connects it to their profile. Nothing asks for a nickname: it is internal to staff.
 */
@Component({
  selector: 'app-register',
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
  templateUrl: './register.component.html',
  styleUrls: ['../login/login.component.scss', './register.component.scss'],
})
export class RegisterComponent implements OnInit {
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
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(128),
        ],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      contact: this.contact,
      acceptTerms: new FormControl(false, {
        nonNullable: true,
        validators: [Validators.requiredTrue],
      }),
    },
    { validators: passwordsMatch },
  );

  gyms: NamedOption[] = [];
  gymSubscriptions: NamedOption[] = [];
  submitting = false;
  /** Set once the account is created: the page then says what happens next. */
  registeredEmail: string | null = null;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly registration: RegistrationService,
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
    const payload: RegisterPayload = {
      email: raw.email.trim(),
      password: raw.password,
      confirmPassword: raw.confirmPassword,
      name: raw.name.trim(),
      phone: contact.phone ?? '',
      gymSubscriptionId: contact.gymSubscriptionId,
      preferredGymId: contact.homeGymId,
      instagram: contact.instagram,
      facebook: contact.facebook,
      tiktok: contact.tiktok,
      acceptTerms: raw.acceptTerms,
    };

    this.submitting = true;
    this.registration.register(payload).subscribe({
      next: (account) => {
        this.submitting = false;
        this.registeredEmail = account.email;
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.submitting = false;
        this.errorMessage = apiErrorMessage(error, 'register.error');
        this.changeDetector.detectChanges();
      },
    });
  }
}
