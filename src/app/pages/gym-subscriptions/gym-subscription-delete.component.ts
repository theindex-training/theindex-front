import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  GymSubscription,
  GymSubscriptionsService
} from '../../services/gym-subscriptions.service';

@Component({
  selector: 'app-gym-subscription-delete',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './gym-subscription-delete.component.html',
  styleUrl: './gym-subscription-delete.component.scss'
})
export class GymSubscriptionDeleteComponent implements OnInit {
  gymSubscription: GymSubscription | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Gym subscription ID is missing.';
      this.loading = false;
      return;
    }

    this.gymSubscriptionsService.getById(id).subscribe({
      next: (gymSubscription) => {
        this.gymSubscription = gymSubscription;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load this gym subscription.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  confirmDeactivate(): void {
    if (!this.gymSubscription) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.gymSubscriptionsService.deactivate(this.gymSubscription.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gym-subscriptions']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to deactivate this gym subscription right now.';
        this.submitting = false;
      }
    });
  }
}
