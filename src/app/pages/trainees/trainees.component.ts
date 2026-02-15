import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GymSubscription, GymSubscriptionsService } from '../../services/gym-subscriptions.service';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';

import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainees',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trainees.component.html',
  styleUrl: './trainees.component.scss',
})
export class TraineesComponent implements OnInit {
  trainees: TraineeProfile[] = [];
  filteredTrainees: TraineeProfile[] = [];
  gymSubscriptions: GymSubscription[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  searchTerm = '';
  loading = true;
  errorMessage = '';

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
    this.errorMessage = '';

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
        this.errorMessage = error?.error?.message || 'Unable to load trainees right now.';
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

  formatNickname(trainee: TraineeProfile): string {
    return displayValue(trainee.nickname);
  }

  formatPhone(trainee: TraineeProfile): string {
    return displayValue(trainee.phone);
  }

  hasLinkedAccount(trainee: TraineeProfile): boolean {
    return Boolean(trainee.accountId);
  }

  formatGymSubscription(trainee: TraineeProfile): string {
    if (!trainee.gymSubscriptionId) {
      return '—';
    }

    return (
      this.gymSubscriptions.find(
        (gymSubscription) => gymSubscription.id === trainee.gymSubscriptionId,
      )?.name || '—'
    );
  }
}
