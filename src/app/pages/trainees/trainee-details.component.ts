import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TraineeSubscriptionsTableComponent } from '../../components/trainee-subscriptions-table/trainee-subscriptions-table.component';
import { TraineeTrainingsTableComponent } from '../../components/trainee-trainings-table/trainee-trainings-table.component';
import { AuthService } from '../../services/auth.service';
import {
  AttendanceService,
  AttendanceTraineeTrainingItem,
} from '../../services/attendance.service';
import { Plan, PlansService } from '../../services/plans.service';
import { SubscriptionsService, Subscription } from '../../services/subscriptions.service';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';
import {
  AccountProvisioningService,
  ProvisionedAccount,
} from '../../services/account-provisioning.service';

type SubscriptionFilter = 'ACTIVE' | 'EXHAUSTED' | 'ALL';

const currencyValidator: ValidatorFn = (control: AbstractControl) => {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { currency: true };
  }

  const cents = Math.round(numericValue * 100);
  const difference = Math.abs(cents - numericValue * 100);
  return difference < 1e-6 ? null : { currency: true };
};

import { displayValue } from '../../utils/display.util';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { StatusDotComponent } from '../../components/status-dot/status-dot.component';
import {
  SegmentedControlComponent,
  SegmentedOption
} from '../../components/segmented-control/segmented-control.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';

@Component({
  selector: 'app-trainee-details',
  standalone: true,
  imports: [
    UiMessagePipe,
    TranslocoPipe,
    EnumLabelPipe,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TraineeSubscriptionsTableComponent,
    TraineeTrainingsTableComponent,
    PageHeaderComponent,
    SkeletonListComponent,
    AvatarComponent,
    StatusDotComponent,
    SegmentedControlComponent,
  ],
  templateUrl: './trainee-details.component.html',
  styleUrl: './trainee-details.component.scss',
})
export class TraineeDetailsComponent implements OnInit {
  subscriptionFilter: SubscriptionFilter = 'ACTIVE';
  readonly subscriptionFilterOptions: SegmentedOption<SubscriptionFilter>[] = [
    { value: 'ACTIVE', label: 'subscriptions.filter.active' },
    { value: 'EXHAUSTED', label: 'subscriptions.filter.exhausted' },
    { value: 'ALL', label: 'common.all' },
  ];

  trainee: TraineeProfile | null = null;
  account: ProvisionedAccount | null = null;
  subscriptions: Subscription[] = [];
  trainings: AttendanceTraineeTrainingItem[] = [];
  plans: Plan[] = [];
  loading = true;
  plansLoading = true;
  subscriptionsLoading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;
  subscriptionErrorMessage: UiMessage | null = null;
  trainingErrorMessage: UiMessage | null = null;
  private readonly i18n = inject(LanguageService);
  private readonly format = inject(LocaleFormatService);
  trainingsLoading = true;
  deletingSubscriptionId: string | null = null;
  canDeleteSubscriptions = false;

  readonly form: FormGroup<{
    planId: FormControl<string>;
    startsAt: FormControl<string>;
    paid: FormControl<number>;
  }>;

  constructor(
    private readonly traineesService: TraineesService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly attendanceService: AttendanceService,
    private readonly plansService: PlansService,
    private readonly accountsService: AccountProvisioningService,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly formBuilder: FormBuilder,
  ) {
    this.form = this.formBuilder.group({
      planId: this.formBuilder.nonNullable.control('', [Validators.required]),
      startsAt: this.formBuilder.nonNullable.control(this.todayString(), [Validators.required]),
      paid: this.formBuilder.nonNullable.control(0, [Validators.required, currencyValidator]),
    });
  }

  ngOnInit(): void {
    const role = this.authService.getUserRole();
    this.canDeleteSubscriptions = role === 'ADMIN' || role === 'TRAINER';

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('trainees.errors.missingId');
      this.loading = false;
      return;
    }

    this.loadTrainee(id);
    this.loadSubscriptions(id);
    this.loadTrainings(id);
    this.loadPlans();

    this.form.controls.planId.valueChanges.subscribe((planId) => {
      const plan = this.plans.find((entry) => entry.id === planId);
      if (plan) {
        this.form.controls.paid.setValue(this.toEuros(plan.priceCents));
      }
    });
  }

  handleCreateSubscription(): void {
    if (this.form.invalid || !this.trainee) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      planId: raw.planId,
      startsAt: raw.startsAt || undefined,
      paidCents: this.toCents(raw.paid),
    };

    this.submitting = true;
    this.subscriptionErrorMessage = null;

    this.subscriptionsService.createForTrainee(this.trainee.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.loadSubscriptions(this.trainee!.id);
        this.resetSubscriptionDefaults(raw.planId);
      },
      error: (error) => {
        this.subscriptionErrorMessage =
          apiErrorMessage(error, 'trainees.details.createSubscriptionError');
        this.submitting = false;
      },
    });
  }

  formatNickname(): string {
    return displayValue(this.trainee?.nickname);
  }

  formatPhone(): string {
    return displayValue(this.trainee?.phone);
  }

  hasLinkedAccount(): boolean {
    return Boolean(this.trainee?.accountId);
  }

  formatPlanOption(plan: Plan): string {
    const type = this.i18n.t(`enums.planType.${plan.type}`);
    return `${plan.title} · ${type} · ${this.format.money(plan.priceCents)}`;
  }

  formatPlanLabel(subscription: Subscription): string {
    const plan = this.plans.find((entry) => entry.id === subscription.planId);
    return plan ? plan.title : subscription.planId;
  }

  get filteredSubscriptions(): Subscription[] {
    if (this.subscriptionFilter === 'ALL') {
      return this.subscriptions;
    }

    return this.subscriptions.filter(
      (subscription) => subscription.status.toUpperCase() === this.subscriptionFilter,
    );
  }

  get filteredSubscriptionsEmptyKey(): string {
    if (this.subscriptionFilter === 'ACTIVE') {
      return 'trainees.details.noActiveSubscriptions';
    }

    if (this.subscriptionFilter === 'EXHAUSTED') {
      return 'trainees.details.noExhaustedSubscriptions';
    }

    return 'trainees.details.noSubscriptions';
  }

  deleteSubscription(subscription: Subscription): void {
    if (!this.canDeleteSubscriptions || this.deletingSubscriptionId || !this.trainee) {
      return;
    }

    const confirmed = window.confirm(
      this.i18n.t('trainees.details.confirmDeleteSubscription', {
        plan: this.formatPlanLabel(subscription),
        date: this.format.date(subscription.startsAt),
      }),
    );

    if (!confirmed) {
      return;
    }

    this.deletingSubscriptionId = subscription.id;
    this.subscriptionErrorMessage = null;

    this.subscriptionsService.delete(subscription.id).subscribe({
      next: () => {
        this.subscriptions = this.subscriptions.filter((entry) => entry.id !== subscription.id);
        this.deletingSubscriptionId = null;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.subscriptionErrorMessage =
          apiErrorMessage(error, 'trainees.details.deleteSubscriptionError');
        this.deletingSubscriptionId = null;
        this.changeDetector.detectChanges();
      },
    });
  }

  private loadTrainee(id: string): void {
    this.traineesService.getById(id).subscribe({
      next: (trainee) => {
        this.trainee = trainee;
        this.loading = false;

        if (trainee.accountId) {
          this.loadAccount(trainee.accountId);
        }

        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'trainees.errors.load');
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  private loadAccount(accountId: string): void {
    this.accountsService.getById(accountId).subscribe({
      next: (account) => {
        this.account = account;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.account = null;
        this.changeDetector.detectChanges();
      },
    });
  }

  private loadSubscriptions(id: string): void {
    this.subscriptionsLoading = true;
    this.subscriptionsService.listForTrainee(id).subscribe({
      next: (subscriptions) => {
        this.subscriptions = subscriptions;
        this.subscriptionsLoading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.subscriptionErrorMessage =
          apiErrorMessage(error, 'trainees.details.loadSubscriptionsError');
        this.subscriptionsLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  private loadPlans(): void {
    this.plansLoading = true;
    this.plansService.list(true).subscribe({
      next: (plans) => {
        this.plans = plans;
        this.plansLoading = false;
        this.setDefaultPlan();
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.subscriptionErrorMessage = apiErrorMessage(error, 'trainees.details.loadPlansError');
        this.plansLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  private loadTrainings(id: string): void {
    this.trainingsLoading = true;
    this.trainingErrorMessage = null;

    this.attendanceService.listForTrainee(id).subscribe({
      next: (trainings) => {
        this.trainings = trainings;
        this.trainingsLoading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.trainingErrorMessage = apiErrorMessage(error, 'trainees.details.loadTrainingsError');
        this.trainingsLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  private setDefaultPlan(): void {
    if (!this.plans.length) {
      return;
    }

    const currentPlanId = this.form.controls.planId.value;
    const plan = this.plans.find((entry) => entry.id === currentPlanId) ?? this.plans[0];
    this.form.controls.planId.setValue(plan.id);
    this.form.controls.paid.setValue(this.toEuros(plan.priceCents));
  }

  private resetSubscriptionDefaults(planId: string): void {
    const plan = this.plans.find((entry) => entry.id === planId);
    if (plan) {
      this.form.controls.paid.setValue(this.toEuros(plan.priceCents));
    }
    this.form.controls.startsAt.setValue(this.todayString());
  }

  private toCents(price: number): number {
    return Math.round(price * 100);
  }

  private toEuros(priceCents: number): number {
    return Number((priceCents / 100).toFixed(2));
  }

  private todayString(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
