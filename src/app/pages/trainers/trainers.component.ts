import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trainers.component.html',
  styleUrl: './trainers.component.scss',
})
export class TrainersComponent implements OnInit {
  trainers: TrainerProfile[] = [];
  filteredTrainers: TrainerProfile[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  searchTerm = '';
  loading = true;
  errorMessage = '';

  constructor(
    private readonly trainersService: TrainersService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTrainers();
  }

  loadTrainers(): void {
    this.loading = true;
    this.errorMessage = '';

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
        this.errorMessage = error?.error?.message || 'Unable to load trainers right now.';
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

  formatNickname(trainer: TrainerProfile): string {
    return displayValue(trainer.nickname);
  }

  hasLinkedAccount(trainer: TrainerProfile): boolean {
    return Boolean(trainer.accountId);
  }
}
