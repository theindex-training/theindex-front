import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';

import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainees',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trainees.component.html',
  styleUrl: './trainees.component.scss'
})
export class TraineesComponent implements OnInit {
  trainees: TraineeProfile[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  loading = true;
  errorMessage = '';

  constructor(
    private readonly traineesService: TraineesService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTrainees();
  }

  loadTrainees(): void {
    this.loading = true;
    this.errorMessage = '';

    const active =
      this.activeFilter === 'all'
        ? undefined
        : this.activeFilter === 'active'
          ? true
          : false;

    this.traineesService.list(active).subscribe({
      next: (trainees) => {
        this.trainees = trainees;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load trainees right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatNickname(trainee: TraineeProfile): string {
    return displayValue(trainee.nickname);
  }

  formatPhone(trainee: TraineeProfile): string {
    return displayValue(trainee.phone);
  }

  formatAccount(trainee: TraineeProfile): string {
    return trainee.accountId ? 'Linked' : 'Unlinked';
  }
}
