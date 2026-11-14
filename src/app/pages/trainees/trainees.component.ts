import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SearchFieldComponent } from '../../components/search-field/search-field.component';
import { SegmentedControlComponent } from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import {
  GymSubscription,
  GymSubscriptionsService,
} from '../../services/gym-subscriptions.service';
import { LanguageService } from '../../i18n/language.service';
import { UiMessage, apiErrorMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  TraineeProfile,
  TraineesService,
} from '../../services/trainees.service';

import {
  ACCOUNT_FILTER_OPTIONS,
  AccountFilter,
  matchesAccountFilter,
} from '../../utils/account-filter.util';
import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainees',
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
  templateUrl: './trainees.component.html',
})
export class TraineesComponent implements OnInit {
  trainees: TraineeProfile[] = [];
  filteredTrainees: TraineeProfile[] = [];
  gymSubscriptions: GymSubscription[] = [];
  /** Trainees left by the account filter, before the search. */
  accountTrainees: TraineeProfile[] = [];
  accountFilter: AccountFilter = 'all';
  readonly accountOptions = ACCOUNT_FILTER_OPTIONS;
  searchTerm = '';
  loading = true;
  errorMessage: UiMessage | null = null;
  private readonly i18n = inject(LanguageService);

  constructor(
    private readonly traineesService: TraineesService,
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadGymSubscriptions();
    this.loadTrainees();
  }

  loadGymSubscriptions(): void {
    this.gymSubscriptionsService.list(true).subscribe({
      next: (gymSubscriptions) => {
        this.gymSubscriptions = gymSubscriptions;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.gymSubscriptions = [];
        this.changeDetector.detectChanges();
      },
    });
  }

  loadTrainees(): void {
    this.loading = true;
    this.errorMessage = null;

    // Deleting a trainee only deactivates it, so the list asks for the active ones: the others
    // are gone as far as the app is concerned.
    this.traineesService.list(true).subscribe({
      next: (trainees) => {
        this.trainees = trainees;
        this.applySearch();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'trainees.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  setAccountFilter(filter: AccountFilter): void {
    this.accountFilter = filter;
    this.applySearch();
  }

  /** Applies the account filter, then the search. */
  applySearch(): void {
    this.accountTrainees = this.trainees.filter((trainee) =>
      matchesAccountFilter(trainee, this.accountFilter),
    );
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      this.filteredTrainees = [...this.accountTrainees];
      return;
    }

    this.filteredTrainees = this.accountTrainees.filter((trainee) => {
      const name = trainee.name.toLowerCase();
      const nickname = (trainee.nickname || '').toLowerCase();
      return name.includes(query) || nickname.includes(query);
    });
  }

  /** Nickname in the language's quotes (“Gosho” / „Гошо“) for the title suffix. */
  quotedNickname(value: string | null): string {
    return value ? this.i18n.t('common.quoted', { text: value }) : '';
  }

  nicknameLabel(trainee: TraineeProfile): string {
    const nickname = trainee.nickname?.trim();
    return nickname
      ? this.i18n.t('common.quoted', { text: nickname })
      : this.i18n.t('common.noNickname');
  }

  formatPhone(trainee: TraineeProfile): string {
    return displayValue(trainee.phone);
  }

  hasLinkedAccount(trainee: TraineeProfile): boolean {
    return Boolean(trainee.accountId);
  }

  gymCardName(trainee: TraineeProfile): string | null {
    if (!trainee.gymSubscriptionId) {
      return null;
    }

    return (
      this.gymSubscriptions.find(
        (gymSubscription) => gymSubscription.id === trainee.gymSubscriptionId,
      )?.name || null
    );
  }
}
