import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { PaginationComponent } from '../../components/pagination/pagination.component';
import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  pageOffset,
  pageRange,
  parsePage,
  parsePageSize,
} from '../../components/pagination/pagination';
import {
  CashRegisterService,
  CashRegisterTransaction,
  CreateManualCashRegisterTransactionPayload,
} from '../../services/cash-register.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { LanguageService } from '../../i18n/language.service';
import { enumLabelKey, isKnownEnum } from '../../i18n/enum-labels';

const currencyValidator: ValidatorFn = (control: AbstractControl) => {
  if (
    control.value === null ||
    control.value === undefined ||
    control.value === ''
  ) {
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
    ChipComponent,
    PaginationComponent,
  ],
  templateUrl: './cash-register.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './cash-register.component.scss',
})
/**
 * The balance, the manual transaction form and the transactions, newest first. The transactions are
 * paged by the API (`offset`/`limit`, `app-pagination`); the page and page size are kept in the
 * address (`?page=3&size=100`, the defaults left out, replacing the entry), so going back from a
 * trainee returns to the same rows. Every page's answer carries the balance too.
 */
export class CashRegisterComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  balanceCents = 0;
  transactions: CashRegisterTransaction[] = [];
  /** How many transactions there are in all. */
  total = 0;
  /** The page shown (or on its way), from `?page=`. */
  page = 1;
  pageSize = DEFAULT_PAGE_SIZE;
  /** The page and page size of the rows shown (the last answer), which a failed page keeps. */
  shownPage = 1;
  shownPageSize = DEFAULT_PAGE_SIZE;

  /** Until the first answer: the skeleton. Later pages keep the rows until theirs come. */
  loading = true;
  /** A page or page size on its way; the shown rows are about to be replaced. */
  updating = false;
  creatingTransaction = false;
  /** The first load failed: nothing to show. */
  errorMessage: UiMessage | null = null;
  /** A later page failed: the rows shown stay. */
  pageErrorMessage: UiMessage | null = null;
  formErrorMessage: UiMessage | null = null;
  formSuccessMessage: UiMessage | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    direction: this.formBuilder.nonNullable.control<'IN' | 'OUT'>('IN', [
      Validators.required,
    ]),
    amount: this.formBuilder.nonNullable.control(0, [
      Validators.required,
      Validators.min(0.01),
      currencyValidator,
    ]),
    notes: this.formBuilder.control(''),
  });

  /** The start of the transactions, brought into view after a page change. */
  @ViewChild('listTop') private listTop?: ElementRef<HTMLElement>;

  /** The query of the page shown (or on its way), so a repeated one isn't sent again. */
  private stateKey = '';
  private stateRequest?: Subscription;
  private scrollPending = false;
  private paramsApplied = false;

  constructor(
    private readonly cashRegisterService: CashRegisterService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // The page is reused when only the query changes (page, size).
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyParams(params));
  }

  /** The page and page size from the address; loads the transactions they need. */
  private applyParams(params: ParamMap): void {
    this.page = parsePage(params.get('page'));
    this.pageSize = parsePageSize(params.get('size'));
    this.loadState(false);
    // The first call comes from ngOnInit, which the first check follows anyway.
    if (this.paramsApplied) {
      this.changeDetector.detectChanges();
    }
    this.paramsApplied = true;
  }

  /**
   * Loads the balance and the page of transactions asked for; `force` asks again for the same one
   * (after a save, or "Try again"). Until something is shown it is the skeleton, then the rows
   * stay until the new ones come.
   */
  loadState(force = true): void {
    const query = {
      offset: pageOffset(this.page, this.pageSize),
      limit: this.pageSize,
    };
    const key = JSON.stringify(query);
    if (!force && key === this.stateKey) {
      return;
    }

    this.stateKey = key;
    this.stateRequest?.unsubscribe();
    const shown = !this.loading && !this.errorMessage;
    this.loading = !shown;
    this.updating = shown;
    this.errorMessage = null;
    this.pageErrorMessage = null;

    this.stateRequest = this.cashRegisterService
      .getCurrentState(query)
      .subscribe({
        next: (response) => {
          // A page past the end (an old link, or fewer rows since): show the last one instead.
          const last = clampPage(this.page, response.total, this.pageSize);
          if (!response.transactions.length && last < this.page) {
            this.goTo({ page: last });
            return;
          }
          this.balanceCents = response.balanceCents;
          this.transactions = response.transactions;
          this.total = response.total;
          this.shownPage = this.page;
          this.shownPageSize = this.pageSize;
          this.loading = false;
          this.updating = false;
          this.changeDetector.detectChanges();
          this.scrollToList();
        },
        error: (error) => {
          if (shown) {
            this.pageErrorMessage = apiErrorMessage(
              error,
              'cashRegister.loadPageError',
            );
          } else {
            this.errorMessage = apiErrorMessage(
              error,
              'cashRegister.loadErrorMessage',
            );
          }
          // Asking again for the same page is a retry.
          this.stateKey = '';
          this.loading = false;
          this.updating = false;
          this.changeDetector.detectChanges();
        },
      });
  }

  changePage(page: number): void {
    this.scrollPending = true;
    this.goTo({ page });
  }

  changePageSize(pageSize: number): void {
    this.goTo({ size: pageSize, page: 1 });
  }

  /**
   * The page the controls show: the one asked for, or after a failed page the one whose rows are
   * still shown ("Try again" still asks for the failed one).
   */
  get pagerPage(): number {
    return this.pageErrorMessage ? this.shownPage : this.page;
  }

  get pagerPageSize(): number {
    return this.pageErrorMessage ? this.shownPageSize : this.pageSize;
  }

  /** "51–100 of 4,812 transactions" for the rows shown, or null while there is nothing to count. */
  get shownRange(): string | null {
    if (this.loading || !this.total) {
      return null;
    }
    const { from, to } = pageRange(
      this.shownPage,
      this.shownPageSize,
      this.total,
    );
    return this.i18n.t('cashRegister.showingRange', {
      from: this.format.number(from),
      to: this.format.number(to),
      total: this.total,
      totalText: this.format.number(this.total),
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
      notes: raw.notes?.trim() ? raw.notes.trim() : undefined,
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
        // The new transaction is the newest: show the first page, with the new balance.
        if (this.page > 1) {
          this.goTo({ page: 1 });
        } else {
          this.loadState();
        }
      },
      error: (error) => {
        this.formErrorMessage = apiErrorMessage(
          error,
          'cashRegister.createError',
        );
        this.creatingTransaction = false;
        this.changeDetector.detectChanges();
      },
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
          end: this.format.date(details.periodEnd),
        });
      }

      return this.i18n.t('cashRegister.settlementTransaction');
    }

    if (transaction.sourceType === 'SUBSCRIPTION') {
      const parts = this.formatSubscriptionDetailParts(transaction);
      return parts.length
        ? parts.join(' • ')
        : this.i18n.t('cashRegister.subscriptionPurchase');
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
    return isKnownEnum('cashTransactionType', type)
      ? this.i18n.t(key)
      : this.formatLabel(type);
  }

  private formatSubscriptionDetailParts(
    transaction: CashRegisterTransaction,
    includeBuyer = true,
  ): string[] {
    const details = transaction.sourceDetails;
    if (!details) {
      return [];
    }

    const boughtByLabel =
      includeBuyer && details.boughtBy
        ? this.i18n.t('cashRegister.boughtBy', {
            name: this.formatSubscriptionBuyerLabel(transaction),
          })
        : undefined;
    const planTitle = details.planTitle;
    const subscriptionType = details.subscriptionType
      ? this.formatSubscriptionType(details.subscriptionType)
      : undefined;

    return [
      boughtByLabel,
      planTitle
        ? this.i18n.t('cashRegister.planPart', { plan: planTitle })
        : undefined,
      subscriptionType
        ? this.i18n.t('cashRegister.typePart', { type: subscriptionType })
        : undefined,
    ].filter((part): part is string => Boolean(part));
  }

  /** Puts the new settings in the address (replacing the entry); `applyParams` takes them from there. */
  private goTo(changes: { page?: number; size?: number }): void {
    const next = { page: this.page, size: this.pageSize, ...changes };
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        page: next.page > 1 ? next.page : null,
        size: next.size === DEFAULT_PAGE_SIZE ? null : next.size,
      },
    });
  }

  /** After a page change, brings the top of the list into view when it is scrolled past. */
  private scrollToList(): void {
    if (!this.scrollPending) {
      return;
    }
    this.scrollPending = false;
    const top = this.listTop?.nativeElement;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView?.({ block: 'start' });
    }
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
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
