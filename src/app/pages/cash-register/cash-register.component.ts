import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ChipComponent } from '../../components/chip/chip.component';
import {
  CashRegisterService,
  CashRegisterTransaction,
  CreateManualCashRegisterTransactionPayload
} from '../../services/cash-register.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { LanguageService } from '../../i18n/language.service';
import { enumLabelKey, isKnownEnum } from '../../i18n/enum-labels';

const currencyValidator: ValidatorFn = (control: AbstractControl) => {
  if (control.value === null || control.value === undefined || control.value === '') {
    return null;
  }

  const numericValue = Number(control.value);
  if (!Number.isFinite(numericValue)) {
    return { currency: true };
  }

  const cents = Math.round(numericValue * 100);
  const difference = Math.abs(cents - numericValue * 100);
  return difference < 1e-6 ? null : { currency: true };
};

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [
    UiMessagePipe, 
    TranslocoPipe, 
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ChipComponent
  ],
  templateUrl: './cash-register.component.html',
  styleUrl: './cash-register.component.scss'
})
export class CashRegisterComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);
  private readonly formBuilder = inject(FormBuilder);

  balanceCents = 0;
  transactions: CashRegisterTransaction[] = [];

  loading = true;
  creatingTransaction = false;
  errorMessage: UiMessage | null = null;
  formErrorMessage: UiMessage | null = null;
  formSuccessMessage: UiMessage | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    direction: this.formBuilder.nonNullable.control<'IN' | 'OUT'>('IN', [Validators.required]),
    amount: this.formBuilder.nonNullable.control(0, [
      Validators.required,
      Validators.min(0.01),
      currencyValidator
    ]),
    notes: this.formBuilder.control('')
  });

  constructor(
    private readonly cashRegisterService: CashRegisterService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadState();
  }

  loadState(): void {
    this.loading = true;
    this.errorMessage = null;

    this.cashRegisterService.getCurrentState().subscribe({
      next: response => {
        this.balanceCents = response.balanceCents;
        this.transactions = response.transactions;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage = apiErrorMessage(error, 'cashRegister.loadErrorMessage');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  createManualTransaction(): void {
    this.formSuccessMessage = null;
    this.formErrorMessage = null;

    if (this.creatingTransaction) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.creatingTransaction = true;
    const raw = this.form.getRawValue();
    const payload: CreateManualCashRegisterTransactionPayload = {
      direction: raw.direction,
      amountCents: this.toCents(raw.amount),
      notes: raw.notes?.trim() ? raw.notes.trim() : undefined
    };

    this.cashRegisterService.createManualTransaction(payload).subscribe({
      next: () => {
        this.form.controls.amount.setValue(0);
        this.form.controls.notes.setValue('');
        this.form.controls.direction.setValue('IN');
        this.form.markAsPristine();
        this.form.markAsUntouched();
        this.creatingTransaction = false;
        this.formSuccessMessage = i18nMessage('cashRegister.created');
        this.loadState();
      },
      error: error => {
        this.formErrorMessage =
          apiErrorMessage(error, 'cashRegister.createError');
        this.creatingTransaction = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatCurrency(amountCents: number): string {
    return this.format.money(amountCents);
  }

  formatDate(value: string): string {
    return this.format.dateTime(value);
  }

  formatTransactionDetails(transaction: CashRegisterTransaction): string {
    const details = transaction.sourceDetails;

    if (!details) {
      return '-';
    }

    if (transaction.sourceType === 'SETTLEMENT') {
      if (details.periodStart && details.periodEnd) {
        return this.i18n.t('cashRegister.settlementPeriod', {
          start: this.format.date(details.periodStart),
          end: this.format.date(details.periodEnd)
        });
      }

      return this.i18n.t('cashRegister.settlementTransaction');
    }

    if (transaction.sourceType === 'SUBSCRIPTION') {
      const parts = this.formatSubscriptionDetailParts(transaction);
      return parts.length ? parts.join(' • ') : this.i18n.t('cashRegister.subscriptionPurchase');
    }

    return '-';
  }

  isSubscriptionTransaction(transaction: CashRegisterTransaction): boolean {
    return transaction.sourceType === 'SUBSCRIPTION';
  }

  formatSubscriptionBuyerLabel(transaction: CashRegisterTransaction): string {
    const boughtBy = transaction.sourceDetails?.boughtBy;
    if (!boughtBy) {
      return this.i18n.t('cashRegister.unknownTrainee');
    }

    const nickname = boughtBy.nickname?.trim();
    return nickname ? `${boughtBy.name} (${nickname})` : boughtBy.name;
  }

  formatSubscriptionBuyerPath(transaction: CashRegisterTransaction): string[] {
    const traineeId = transaction.sourceDetails?.boughtBy?.traineeId;
    return traineeId ? ['/trainees', traineeId] : ['/trainees'];
  }

  formatSubscriptionDetailSuffix(transaction: CashRegisterTransaction): string {
    const details = transaction.sourceDetails;
    if (!details) {
      return '';
    }

    const parts = this.formatSubscriptionDetailParts(transaction, false);

    return parts.length ? ` • ${parts.join(' • ')}` : '';
  }

  formatTransactionType(type: string): string {
    const key = enumLabelKey('cashTransactionType', type);
    return isKnownEnum('cashTransactionType', type) ? this.i18n.t(key) : this.formatLabel(type);
  }

  private formatSubscriptionDetailParts(
    transaction: CashRegisterTransaction,
    includeBuyer = true
  ): string[] {
    const details = transaction.sourceDetails;
    if (!details) {
      return [];
    }

    const boughtByLabel =
      includeBuyer && details.boughtBy
        ? this.i18n.t('cashRegister.boughtBy', { name: this.formatSubscriptionBuyerLabel(transaction) })
        : undefined;
    const planTitle = details.planTitle;
    const subscriptionType = details.subscriptionType
      ? this.formatSubscriptionType(details.subscriptionType)
      : undefined;

    return [
      boughtByLabel,
      planTitle ? this.i18n.t('cashRegister.planPart', { plan: planTitle }) : undefined,
      subscriptionType ? this.i18n.t('cashRegister.typePart', { type: subscriptionType }) : undefined
    ].filter((part): part is string => Boolean(part));
  }

  private toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  /** PUNCH / TIME through the plan type labels; anything unknown is humanized. */
  private formatSubscriptionType(value: string): string {
    return isKnownEnum('planType', value)
      ? this.i18n.t(enumLabelKey('planType', value))
      : this.formatLabel(value);
  }

  private formatLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
