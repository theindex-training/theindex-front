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
import { GymLocation, GymLocationsService } from '../../services/gym-locations.service';

import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-gyms',
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
  templateUrl: './gyms.component.html'
})
export class GymsComponent implements OnInit {
  gyms: GymLocation[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  readonly statusOptions: SegmentedOption<'all' | 'active' | 'inactive'>[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];
  loading = true;
  errorMessage = '';

  constructor(
    private readonly gymsService: GymLocationsService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadGyms();
  }

  loadGyms(): void {
    this.loading = true;
    this.errorMessage = '';

    const includeInactive = this.activeFilter !== 'active';

    this.gymsService.list(includeInactive).subscribe({
      next: (gyms) => {
        this.gyms =
          this.activeFilter === 'inactive'
            ? gyms.filter((gym) => !gym.isActive)
            : gyms;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load gyms right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatAddress(gym: GymLocation): string {
    return displayValue(gym.address);
  }
}
