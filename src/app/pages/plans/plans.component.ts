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
import { Plan, PlansService } from '../../services/plans.service';

@Component({
  selector: 'app-plans',
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
  templateUrl: './plans.component.html'
})
export class PlansComponent implements OnInit {
  plans: Plan[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  readonly statusOptions: SegmentedOption<'all' | 'active' | 'inactive'>[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];
  loading = true;
  errorMessage = '';

  constructor(
    private readonly plansService: PlansService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.errorMessage = '';

    const active =
      this.activeFilter === 'all'
        ? undefined
        : this.activeFilter === 'active'
          ? true
          : false;

    this.plansService.list(active).subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load plans right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatPrice(priceCents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(priceCents / 100);
  }

  formatPlanDetails(plan: Plan): string {
    if (plan.type === 'PUNCH') {
      return `${plan.credits ?? 0} credits`;
    }
    return `${plan.durationDays ?? 0} days`;
  }
}
