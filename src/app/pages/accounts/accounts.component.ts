import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SearchFieldComponent } from '../../components/search-field/search-field.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  AccountLinkFilter,
  AccountsService,
  AccountView,
} from '../../services/accounts.service';
import { displayValue } from '../../utils/display.util';
import { accountName, accountPhone, matchesAccount } from './accounts';

/**
 * Accounts (ADMIN): people who created an account themselves wait here until an admin connects
 * it to their trainee or trainer profile. "Not connected" is the default view.
 */
@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    AvatarComponent,
    ChipComponent,
    EmptyStateComponent,
    IconComponent,
    ListRowComponent,
    PageHeaderComponent,
    SearchFieldComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './accounts.component.html',
})
export class AccountsComponent implements OnInit {
  readonly linkOptions: SegmentedOption<AccountLinkFilter>[] = [
    { value: 'unlinked', label: 'accountsAdmin.filter.unlinked' },
    { value: 'linked', label: 'accountsAdmin.filter.linked' },
    { value: 'all', label: 'accountsAdmin.filter.all' },
  ];
  link: AccountLinkFilter = 'unlinked';
  searchTerm = '';
  accounts: AccountView[] = [];
  filtered: AccountView[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  /** The pending load: a new one cancels it, so an older answer never replaces a newer one. */
  private loadSubscription: Subscription | null = null;
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);

  constructor(
    private readonly accountsService: AccountsService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.accountsService.list(this.link).subscribe({
      next: (accounts) => {
        this.accounts = accounts;
        this.applySearch();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(
          error,
          'accountsAdmin.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  applySearch(): void {
    this.filtered = this.accounts.filter((account) =>
      matchesAccount(account, this.searchTerm),
    );
  }

  name(account: AccountView): string {
    return accountName(account);
  }

  phone(account: AccountView): string {
    return displayValue(accountPhone(account));
  }

  /** What the account is connected to, e.g. "Trainee: Ivan Petrov", or "Not connected". */
  profileLabel(account: AccountView): string {
    if (account.profile) {
      return this.i18n.t(`accountsAdmin.profileOf.${account.profile.type}`, {
        name: account.profile.name,
      });
    }
    return account.role === 'ADMIN'
      ? this.i18n.t('enums.role.ADMIN')
      : this.i18n.t('accountsAdmin.notConnected');
  }

  get emptyTitleKey(): string {
    return `accountsAdmin.list.empty.${this.link}`;
  }
}
