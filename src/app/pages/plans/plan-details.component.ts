import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Plan, PlansService } from '../../services/plans.service';

@Component({
  selector: 'app-plan-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './plan-details.component.html',
  styleUrl: './plan-details.component.scss'
})
export class PlanDetailsComponent implements OnInit {
  plan: Plan | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private readonly plansService: PlansService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Plan ID is missing.';
      this.loading = false;
      return;
    }

    this.plansService.getById(id).subscribe({
      next: (plan) => {
        this.plan = plan;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this plan.';
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
