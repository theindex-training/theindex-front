import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  SegmentedControlComponent,
  SegmentedOption
} from '../../components/segmented-control/segmented-control.component';
import { SearchFieldComponent } from '../../components/search-field/search-field.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { StatusDotComponent } from '../../components/status-dot/status-dot.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { IconComponent } from '../../components/icon/icon.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { LanguageService } from '../../i18n/language.service';


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
    ChipComponent,
    StatusDotComponent,
    ListRowComponent,
    IconComponent,
    AvatarComponent
  ],
  templateUrl: './trainers.component.html'
})
export class TrainersComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  trainers: TrainerProfile[] = [];
  filteredTrainers: TrainerProfile[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  readonly statusOptions: SegmentedOption<'all' | 'active' | 'inactive'>[] = [
    { value: 'all', label: 'common.all' },
    { value: 'active', label: 'common.active' },
    { value: 'inactive', label: 'common.inactive' }
  ];
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

    const active =
      this.activeFilter === 'all' ? undefined : this.activeFilter === 'active' ? true : false;

    this.trainersService.list(active).subscribe({
      next: (trainers) => {
        this.trainers = trainers;
        this.applySearch();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'trainers.list.loadErrorMessage');
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  applySearch(): void {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      this.filteredTrainers = [...this.trainers];
      return;
    }

    this.filteredTrainers = this.trainers.filter((trainer) => {
      const name = trainer.name.toLowerCase();
      const nickname = (trainer.nickname || '').toLowerCase();
      return name.includes(query) || nickname.includes(query);
    });
  }

  nicknameLabel(trainer: TrainerProfile): string {
    const nickname = trainer.nickname?.trim();
    return nickname ? `“${nickname}”` : this.i18n.t('common.noNickname');
  }

  hasLinkedAccount(trainer: TrainerProfile): boolean {
    return Boolean(trainer.accountId);
  }
}
