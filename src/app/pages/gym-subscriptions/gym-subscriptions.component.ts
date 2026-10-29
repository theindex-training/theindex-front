import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  SegmentedControlComponent,
  SegmentedOption
} from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { StatusDotComponent } from '../../components/status-dot/status-dot.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { IconComponent } from '../../components/icon/icon.component';
import {
  GymSubscription,
  GymSubscriptionsService
} from '../../services/gym-subscriptions.service';

@Component({
  selector: 'app-gym-subscriptions',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ChipComponent,
    StatusDotComponent,
    ListRowComponent,
    IconComponent
  ],
  templateUrl: './gym-subscriptions.component.html'
})
export class GymSubscriptionsComponent implements OnInit {
  gymSubscriptions: GymSubscription[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  readonly statusOptions: SegmentedOption<'all' | 'active' | 'inactive'>[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];
  loading = true;
  errorMessage = '';

  constructor(
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadGymSubscriptions();
  }

  loadGymSubscriptions(): void {
    this.loading = true;
    this.errorMessage = '';

    const includeInactive = this.activeFilter !== 'active';

    this.gymSubscriptionsService.list(includeInactive).subscribe({
      next: (gymSubscriptions) => {
        this.gymSubscriptions =
          this.activeFilter === 'inactive'
            ? gymSubscriptions.filter((gymSubscription) => !gymSubscription.isActive)
            : gymSubscriptions;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load gym subscriptions right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }
}
