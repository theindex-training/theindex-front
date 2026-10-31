import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ChipComponent, ChipTone } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SearchFieldComponent } from '../../components/search-field/search-field.component';
import {
  SegmentedControlComponent,
  SegmentedOption
} from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { StatusDotComponent } from '../../components/status-dot/status-dot.component';
import { GymSubscription, GymSubscriptionsService } from '../../services/gym-subscriptions.service';
import { LanguageService } from '../../i18n/language.service';
import { UiMessage, apiErrorMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';

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
    StatusDotComponent,
  ],
  templateUrl: './trainees.component.html',
})
export class TraineesComponent implements OnInit {
  trainees: TraineeProfile[] = [];
  filteredTrainees: TraineeProfile[] = [];
  gymSubscriptions: GymSubscription[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  readonly statusOptions: SegmentedOption<'all' | 'active' | 'inactive'>[] = [
    { value: 'all', label: 'common.all' },
    { value: 'active', label: 'common.active' },
    { value: 'inactive', label: 'common.inactive' },
  ];
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

    const active =
      this.activeFilter === 'all' ? undefined : this.activeFilter === 'active' ? true : false;

    this.traineesService.list(active).subscribe({
      next: (trainees) => {
        this.trainees = trainees;
        this.applySearch();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'trainees.list.loadErrorMessage');
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  applySearch(): void {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      this.filteredTrainees = [...this.trainees];
      return;
    }

    this.filteredTrainees = this.trainees.filter((trainee) => {
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
    return nickname ? this.i18n.t('common.quoted', { text: nickname }) : this.i18n.t('common.noNickname');
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

  /** Mobile rows show one chip: "Inactive" for inactive trainees, otherwise their gym card. */
  trailingChip(trainee: TraineeProfile): { label: string; tone: ChipTone } | null {
    if (!trainee.isActive) {
      return { label: this.i18n.t('trainees.status.inactive'), tone: 'neutral' };
    }

    const gymCard = this.gymCardName(trainee);
    return gymCard ? { label: gymCard, tone: 'accent' } : null;
  }
}
