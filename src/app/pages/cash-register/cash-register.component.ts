import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import {
  CashRegisterService,
  CashRegisterTransaction,
  CreateManualCashRegisterTransactionPayload
} from '../../services/cash-register.service';

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cash-register.component.html',
  styleUrl: './cash-register.component.scss'
})
export class CashRegisterComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);

  balanceCents = 0;
  transactions: CashRegisterTransaction[] = [];

  loading = true;
  creatingTransaction = false;
  errorMessage = '';
  formErrorMessage = '';
  formSuccessMessage = '';

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
    this.errorMessage = '';

    this.cashRegisterService.getCurrentState().subscribe({
      next: response => {
        this.balanceCents = response.balanceCents;
        this.transactions = response.transactions;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'Unable to load cash register data right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  createManualTransaction(): void {
    this.formSuccessMessage = '';
    this.formErrorMessage = '';

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
        this.formSuccessMessage = 'Manual transaction created successfully.';
        this.loadState();
      },
      error: error => {
        this.formErrorMessage =
          error?.error?.message || 'Unable to create manual transaction right now.';
        this.creatingTransaction = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatCurrency(amountCents: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'EUR'
    }).format(amountCents / 100);
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  formatTransactionDetails(transaction: CashRegisterTransaction): string {
    const details = transaction.sourceDetails;

    if (!details) {
      return '-';
    }

    if (transaction.sourceType === 'SETTLEMENT') {
      if (details.periodStart && details.periodEnd) {
        return `Settlement period: ${details.periodStart} → ${details.periodEnd}`;
      }

      return 'Settlement transaction';
    }

    if (transaction.sourceType === 'SUBSCRIPTION') {
      const buyerName = details.boughtBy?.nickname || details.boughtBy?.name;
      const planTitle = details.planTitle;
      const subscriptionType = details.subscriptionType
        ? this.formatLabel(details.subscriptionType)
        : undefined;

      const parts = [
        buyerName ? `Bought by ${buyerName}` : undefined,
        planTitle ? `Plan: ${planTitle}` : undefined,
        subscriptionType ? `Type: ${subscriptionType}` : undefined
      ].filter((part): part is string => Boolean(part));

      if (parts.length) {
        return parts.join(' • ');
      }

      return 'Subscription purchase';
    }

    return '-';
  }

  private toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  private formatLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
