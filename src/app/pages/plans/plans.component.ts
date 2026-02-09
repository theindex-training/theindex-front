import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Plan, PlansService } from '../../services/plans.service';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.scss'
})
export class PlansComponent implements OnInit {
  plans: Plan[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
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
