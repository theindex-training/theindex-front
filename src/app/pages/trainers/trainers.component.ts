import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SegmentedControlComponent } from '../../components/segmented-control/segmented-control.component';
import { SearchFieldComponent } from '../../components/search-field/search-field.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { IconComponent } from '../../components/icon/icon.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import {
  TrainerProfile,
  TrainersService,
} from '../../services/trainers.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { LanguageService } from '../../i18n/language.service';
import {
  ACCOUNT_FILTER_OPTIONS,
  AccountFilter,
  matchesAccountFilter,
} from '../../utils/account-filter.util';

@Component({
  selector: 'app-trainers',
  standalone: true,
  imports: [
    UiMessagePipe,
    TranslocoPipe,
    RouterLink,
    PageHeaderComponent,
    SegmentedControlComponent,
    SearchFieldComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ListRowComponent,
    IconComponent,
    AvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './trainers.component.html',
})
export class TrainersComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  trainers: TrainerProfile[] = [];
  filteredTrainers: TrainerProfile[] = [];
  /** Trainers left by the account filter, before the search. */
  accountTrainers: TrainerProfile[] = [];
  accountFilter: AccountFilter = 'all';
  readonly accountOptions = ACCOUNT_FILTER_OPTIONS;
  searchTerm = '';
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly trainersService: TrainersService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTrainers();
  }

  loadTrainers(): void {
    this.loading = true;
    this.errorMessage = null;

    // Deleting a trainer only deactivates it, so the list asks for the active ones: the others
    // are gone as far as the app is concerned.
    this.trainersService.list(true).subscribe({
      next: (trainers) => {
        this.trainers = trainers;
        this.applySearch();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'trainers.list.loadErrorMessage',
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
    this.accountTrainers = this.trainers.filter((trainer) =>
      matchesAccountFilter(trainer, this.accountFilter),
    );
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      this.filteredTrainers = [...this.accountTrainers];
      return;
    }

    this.filteredTrainers = this.accountTrainers.filter((trainer) => {
      const name = trainer.name.toLowerCase();
      const nickname = (trainer.nickname || '').toLowerCase();
      return name.includes(query) || nickname.includes(query);
    });
  }

  /** Nickname in the language's quotes (“Gosho” / „Гошо“) for the title suffix. */
  quotedNickname(value: string | null): string {
    return value ? this.i18n.t('common.quoted', { text: value }) : '';
  }

  nicknameLabel(trainer: TrainerProfile): string {
    const nickname = trainer.nickname?.trim();
    return nickname
      ? this.i18n.t('common.quoted', { text: nickname })
      : this.i18n.t('common.noNickname');
  }

  hasLinkedAccount(trainer: TrainerProfile): boolean {
    return Boolean(trainer.accountId);
  }
}
