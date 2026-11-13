import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContactFieldsComponent } from '../../components/contact-fields/contact-fields.component';
import {
  contactForm,
  contactValues,
  fillContactForm,
} from '../../components/contact-fields/contact-form';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  MyProfile,
  MyProfileService,
  UpdateMyProfilePayload,
} from '../../services/my-profile.service';
import {
  NamedOption,
  RegistrationService,
} from '../../services/registration.service';

/**
 * "My details" (TRAINEE, TRAINER): what people could enter when they registered. The name and email
 * are shown, not changed (an admin does that); the nickname is internal to staff and never shown.
 */
@Component({
  selector: 'app-my-details',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    ContactFieldsComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './my-details.component.html',
})
export class MyDetailsComponent implements OnInit {
  readonly form = contactForm({ phoneRequired: true });

  profile: MyProfile | null = null;
  gyms: NamedOption[] = [];
  gymSubscriptions: NamedOption[] = [];
  loading = true;
  loadError: UiMessage | null = null;
  saving = false;
  errorMessage: UiMessage | null = null;
  successMessage: UiMessage | null = null;

  readonly format = inject(LocaleFormatService);

  constructor(
    private readonly myProfile: MyProfileService,
    private readonly registration: RegistrationService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
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
    this.myProfile.get().subscribe({
      next: (profile) => {
        this.show(profile);
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.loading = false;
        this.loadError = apiErrorMessage(error, 'myDetails.loadError');
        this.changeDetector.detectChanges();
      },
    });
  }

  get isTrainee(): boolean {
    return this.profile?.profileType === 'trainee';
  }

  save(): void {
    this.errorMessage = null;
    this.successMessage = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const values = contactValues(this.form);
    const payload: UpdateMyProfilePayload = {
      phone: values.phone ?? '',
      ...(this.isTrainee
        ? { gymSubscriptionId: values.gymSubscriptionId }
        : {}),
      homeGymId: values.homeGymId,
      instagram: values.instagram,
      facebook: values.facebook,
      tiktok: values.tiktok,
    };

    this.saving = true;
    this.myProfile.update(payload).subscribe({
      next: (profile) => {
        this.saving = false;
        this.show(profile);
        this.successMessage = i18nMessage('myDetails.saved');
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.errorMessage = apiErrorMessage(error, 'myDetails.saveError');
        this.changeDetector.detectChanges();
      },
    });
  }

  private show(profile: MyProfile): void {
    this.profile = profile;
    fillContactForm(this.form, profile);
    this.form.markAsUntouched();
  }
}
