import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Plan, PlansService } from '../../services/plans.service';
import { SubscriptionsService, Subscription } from '../../services/subscriptions.service';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';

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

@Component({
  selector: 'app-trainee-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './trainee-details.component.html',
  styleUrl: './trainee-details.component.scss'
})
export class TraineeDetailsComponent implements OnInit {
  trainee: TraineeProfile | null = null;
  subscriptions: Subscription[] = [];
  plans: Plan[] = [];
  loading = true;
  plansLoading = true;
  subscriptionsLoading = true;
  submitting = false;
  errorMessage = '';
  subscriptionErrorMessage = '';

  readonly form: FormGroup<{
    planId: FormControl<string>;
    startsAt: FormControl<string>;
    paid: FormControl<number>;
  }>;

  constructor(
    private readonly traineesService: TraineesService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: PlansService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly formBuilder: FormBuilder
  ) {
    this.form = this.formBuilder.group({
      planId: this.formBuilder.nonNullable.control('', [Validators.required]),
      startsAt: this.formBuilder.nonNullable.control(this.todayString(), [
        Validators.required
      ]),
      paid: this.formBuilder.nonNullable.control(0, [
        Validators.required,
        currencyValidator
      ])
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Trainee ID is missing.';
      this.loading = false;
      return;
    }

    this.loadTrainee(id);
    this.loadSubscriptions(id);
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
      paidCents: this.toCents(raw.paid)
    };

    this.submitting = true;
    this.subscriptionErrorMessage = '';

    this.subscriptionsService.createForTrainee(this.trainee.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.loadSubscriptions(this.trainee!.id);
        this.resetSubscriptionDefaults(raw.planId);
      },
      error: (error) => {
        this.subscriptionErrorMessage =
          error?.error?.message || 'Unable to create subscription right now.';
        this.submitting = false;
      }
    });
  }

  formatNickname(): string {
    return displayValue(this.trainee?.nickname);
  }

  formatPhone(): string {
    return displayValue(this.trainee?.phone);
  }

  formatAccount(): string {
    if (!this.trainee) {
      return '—';
    }
    return this.trainee.accountId ? 'Linked' : 'Unlinked';
  }

  formatPlanOption(plan: Plan): string {
    return `${plan.title} · ${plan.type} · ${this.formatPrice(plan.priceCents)}`;
  }

  formatPlanLabel(subscription: Subscription): string {
    const plan = this.plans.find((entry) => entry.id === subscription.planId);
    return plan ? plan.title : subscription.planId;
  }

  formatEndsOrCredits(subscription: Subscription): string {
    if (subscription.type === 'TIME') {
      return subscription.endsAt ? this.formatDate(subscription.endsAt) : '—';
    }

    const remaining = subscription.remainingCredits ?? 0;
    const initial = subscription.initialCredits ?? 0;
    return `${remaining} / ${initial} credits`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(new Date(value));
  }

  formatPrice(priceCents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(priceCents / 100);
  }

  private loadTrainee(id: string): void {
    this.traineesService.getById(id).subscribe({
      next: (trainee) => {
        this.trainee = trainee;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this trainee.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
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
          error?.error?.message || 'Unable to load subscriptions right now.';
        this.subscriptionsLoading = false;
        this.changeDetector.detectChanges();
      }
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
        this.subscriptionErrorMessage =
          error?.error?.message || 'Unable to load plans right now.';
        this.plansLoading = false;
        this.changeDetector.detectChanges();
      }
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
