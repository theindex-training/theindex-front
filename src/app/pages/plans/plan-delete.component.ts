import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Plan, PlansService } from '../../services/plans.service';

@Component({
  selector: 'app-plan-delete',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './plan-delete.component.html',
  styleUrl: './plan-delete.component.scss'
})
export class PlanDeleteComponent implements OnInit {
  plan: Plan | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly plansService: PlansService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
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
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this plan.';
        this.loading = false;
      }
    });
  }

  confirmDeactivate(): void {
    if (!this.plan) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.plansService.update(this.plan.id, { isActive: false }).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/plans']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to deactivate this plan right now.';
        this.submitting = false;
      }
    });
  }

  formatPrice(priceCents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(priceCents / 100);
  }
}
