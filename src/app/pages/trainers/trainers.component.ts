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
  styleUrl: './trainers.component.scss'
})
export class TrainersComponent implements OnInit {
  trainers: TrainerProfile[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  loading = true;
  errorMessage = '';

  constructor(
    private readonly trainersService: TrainersService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTrainers();
  }

  loadTrainers(): void {
    this.loading = true;
    this.errorMessage = '';

    const active =
      this.activeFilter === 'all'
        ? undefined
        : this.activeFilter === 'active'
          ? true
          : false;

    this.trainersService.list(active).subscribe({
      next: (trainers) => {
        this.trainers = trainers;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load trainers right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatNickname(trainer: TrainerProfile): string {
    return displayValue(trainer.nickname);
  }

  formatAccount(trainer: TrainerProfile): string {
    return trainer.accountId ? 'Linked' : 'Unlinked';
  }
}
