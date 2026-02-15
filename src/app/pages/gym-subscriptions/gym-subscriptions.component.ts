import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  GymSubscription,
  GymSubscriptionsService
} from '../../services/gym-subscriptions.service';

@Component({
  selector: 'app-gym-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gym-subscriptions.component.html',
  styleUrl: './gym-subscriptions.component.scss'
})
export class GymSubscriptionsComponent implements OnInit {
  gymSubscriptions: GymSubscription[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
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
