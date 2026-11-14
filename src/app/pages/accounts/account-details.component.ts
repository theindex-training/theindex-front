import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { ContactFieldsComponent } from '../../components/contact-fields/contact-fields.component';
import { FieldDifferenceComponent } from '../../components/field-difference/field-difference.component';
import {
  contactForm,
  contactValues,
  fillContactForm,
} from '../../components/contact-fields/contact-form';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { StatusDotComponent } from '../../components/status-dot/status-dot.component';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  AccountsService,
  AccountView,
  ProfileType,
} from '../../services/accounts.service';
import {
  NamedOption,
  RegistrationService,
} from '../../services/registration.service';
import { TraineesService } from '../../services/trainees.service';
import { TrainersService } from '../../services/trainers.service';
import {
  SOCIAL_NETWORKS,
  SocialNetwork,
  socialProfileUrl,
} from '../../utils/contact.util';
import { displayValue } from '../../utils/display.util';
import { trimmedLength } from '../../utils/form-validators.util';
import {
  accountName,
  LinkableProfile,
  LinkDifferences,
  linkFormValues,
  linkPayload,
  profileDifferences,
  suggestProfiles,
} from './accounts';

type ProfileMode = 'new' | 'existing';

/**
 * One account (ADMIN): what the person registered and, while it isn't connected, connecting it to
 * a trainee or trainer profile (a new one or an existing one) with the values the admin decides,
 * or deleting it for good.
 */
@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    ContactFieldsComponent,
    FieldDifferenceComponent,
    PageHeaderComponent,
    SegmentedControlComponent,
    StatusDotComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './account-details.component.html',
})
export class AccountDetailsComponent implements OnInit {
  readonly typeOptions: SegmentedOption<ProfileType>[] = [
    { value: 'trainee', label: 'accountsAdmin.connect.trainee' },
    { value: 'trainer', label: 'accountsAdmin.connect.trainer' },
  ];
  // Most people already have a profile when they register, so connecting to one comes first.
  readonly modeOptions: SegmentedOption<ProfileMode>[] = [
    { value: 'existing', label: 'accountsAdmin.connect.existingProfile' },
    { value: 'new', label: 'accountsAdmin.connect.newProfile' },
  ];
  readonly networks = SOCIAL_NETWORKS;

  readonly contact = contactForm({ phoneRequired: false });
  readonly form = new FormGroup({
    profileId: new FormControl('', { nonNullable: true }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, trimmedLength(2, 100)],
    }),
    nickname: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(1, 50)],
    }),
    contact: this.contact,
  });

  account: AccountView | null = null;
  loading = true;
  loadError: UiMessage | null = null;

  profileType: ProfileType = 'trainee';
  mode: ProfileMode = 'existing';
  /** Where the picked profile stores something other than what the person registered. */
  differences: LinkDifferences = {};
  /** Active profiles of the chosen type without an account, once loaded. */
  candidates: LinkableProfile[] | null = null;
  candidatesError: UiMessage | null = null;
  suggested: LinkableProfile[] = [];
  others: LinkableProfile[] = [];

  gyms: NamedOption[] = [];
  gymSubscriptions: NamedOption[] = [];

  connecting = false;
  deleting = false;
  errorMessage: UiMessage | null = null;
  successMessage: UiMessage | null = null;

  private readonly candidateCache = new Map<ProfileType, LinkableProfile[]>();
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly accountsService: AccountsService,
    private readonly registration: RegistrationService,
    private readonly trainees: TraineesService,
    private readonly trainers: TrainersService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      this.loadError = i18nMessage('common.missingId');
      return;
    }

    this.registration.options().subscribe({
      next: (options) => {
        this.gyms = options.gyms;
        this.gymSubscriptions = options.gymSubscriptions;
        this.changeDetector.detectChanges();
      },
      error: () => undefined,
    });

    this.accountsService.details(id).subscribe({
      next: (account) => {
        this.account = account;
        this.loading = false;
        this.fillForm();
        if (this.canConnect) {
          this.loadCandidates();
        }
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.loading = false;
        this.loadError = apiErrorMessage(
          error,
          'accountsAdmin.details.loadError',
        );
        this.changeDetector.detectChanges();
      },
    });
  }

  get canConnect(): boolean {
    return (
      !!this.account && !this.account.profile && this.account.role !== 'ADMIN'
    );
  }

  get title(): string {
    return this.account ? accountName(this.account) : '';
  }

  get profileLink(): string[] {
    const profile = this.account?.profile;
    return profile
      ? [profile.type === 'trainee' ? '/trainees' : '/trainers', profile.id]
      : [];
  }

  value(text: string | null | undefined): string {
    return displayValue(text);
  }

  socialUrl(network: SocialNetwork, value: string | null): string | null {
    return socialProfileUrl(network, value);
  }

  invalid(name: 'name' | 'nickname' | 'profileId'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  candidateLabel(profile: LinkableProfile): string {
    return profile.nickname
      ? `${profile.name} ${this.i18n.t('common.quoted', { text: profile.nickname })}`
      : profile.name;
  }

  setType(type: ProfileType): void {
    this.profileType = type;
    this.form.controls.profileId.setValue('');
    this.prepareMode();
  }

  setMode(mode: ProfileMode): void {
    this.mode = mode;
    this.form.controls.profileId.setValue('');
    this.prepareMode();
  }

  /**
   * Whether the fields and Connect show: always for a new profile; for an existing one only once
   * it is picked, so the admin chooses who it is before reading values and differences.
   */
  get showFields(): boolean {
    return this.mode === 'new' || !!this.form.controls.profileId.value;
  }

  /** How many fields the picked profile stores differently from what the person registered. */
  get differenceCount(): number {
    return Object.keys(this.differences).length;
  }

  /** The differences shown under the contact fields (the name has its own). */
  get contactDifferences(): LinkDifferences {
    const contact = { ...this.differences };
    delete contact.name;
    return contact;
  }

  /** The profile's name, while the name field holds something else; '' otherwise. */
  get nameDifference(): string {
    const name = this.differences.name;
    return name && name.trim() !== this.form.controls.name.value.trim()
      ? name
      : '';
  }

  useProfileName(): void {
    this.form.controls.name.setValue(this.differences.name ?? '');
    this.form.controls.name.markAsDirty();
  }

  /** A profile was picked: the form starts from its values (and the registration's). */
  pickProfile(): void {
    this.fillForm();
  }

  connect(): void {
    this.errorMessage = null;
    this.successMessage = null;
    const profileId = this.form.controls.profileId.value;
    if (this.mode === 'existing' && !profileId) {
      this.form.controls.profileId.setErrors({ required: true });
    }
    if (this.form.invalid || (this.mode === 'existing' && !profileId)) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = linkPayload(
      this.profileType,
      this.mode === 'existing' ? profileId : null,
      {
        name: raw.name,
        nickname: raw.nickname,
        contact: contactValues(this.contact),
      },
    );

    this.connecting = true;
    this.accountsService.link(this.account!.id, payload).subscribe({
      next: (account) => {
        this.connecting = false;
        this.account = account;
        this.candidateCache.clear();
        this.successMessage = i18nMessage('accountsAdmin.connect.success', {
          name: account.profile?.name ?? '',
        });
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.connecting = false;
        this.errorMessage = apiErrorMessage(
          error,
          'accountsAdmin.connect.error',
        );
        this.changeDetector.detectChanges();
      },
    });
  }

  deletePermanently(): void {
    if (!this.account) {
      return;
    }
    const confirmed = window.confirm(
      this.i18n.t('accountsAdmin.delete.confirm', {
        email: this.account.email ?? '',
      }),
    );
    if (!confirmed) {
      return;
    }
    this.errorMessage = null;
    this.deleting = true;
    this.accountsService.deletePermanently(this.account.id).subscribe({
      next: () => {
        this.deleting = false;
        void this.router.navigate(['/accounts']);
      },
      error: (error: unknown) => {
        this.deleting = false;
        this.errorMessage = apiErrorMessage(
          error,
          'accountsAdmin.delete.error',
        );
        this.changeDetector.detectChanges();
      },
    });
  }

  private prepareMode(): void {
    this.fillForm();
    if (this.mode === 'existing') {
      this.loadCandidates();
    }
  }

  private fillForm(): void {
    if (!this.account) {
      return;
    }
    const profileId = this.form.controls.profileId.value;
    const profile =
      this.mode === 'existing' && profileId
        ? (this.candidates?.find((c) => c.id === profileId) ?? null)
        : null;
    const values = linkFormValues(
      this.account.registration,
      this.profileType,
      profile,
    );
    this.differences = profileDifferences(
      this.account.registration,
      this.profileType,
      profile,
    );
    this.form.controls.name.setValue(values.name);
    this.form.controls.nickname.setValue(values.nickname);
    fillContactForm(this.contact, values.contact);
    this.form.controls.name.markAsUntouched();
  }

  private loadCandidates(): void {
    const type = this.profileType;
    const cached = this.candidateCache.get(type);
    if (cached) {
      this.setCandidates(cached);
      return;
    }
    this.candidates = null;
    this.candidatesError = null;
    const request: Observable<
      (LinkableProfile & { isActive: boolean; accountId: string | null })[]
    > =
      type === 'trainee' ? this.trainees.list(true) : this.trainers.list(true);
    request.subscribe({
      next: (profiles) => {
        const free = profiles.filter((p) => p.isActive && !p.accountId);
        this.candidateCache.set(type, free);
        if (this.profileType === type) {
          this.setCandidates(free);
        }
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.candidates = [];
        this.candidatesError = apiErrorMessage(
          error,
          'accountsAdmin.connect.profilesError',
        );
        this.changeDetector.detectChanges();
      },
    });
  }

  private setCandidates(profiles: LinkableProfile[]): void {
    this.candidates = profiles;
    const { suggested, others } = suggestProfiles(
      this.account?.registration ?? null,
      profiles,
    );
    this.suggested = suggested;
    this.others = others;
  }
}
