import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainer-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trainer-details.component.html',
  styleUrl: './trainer-details.component.scss'
})
export class TrainerDetailsComponent implements OnInit {
  trainer: TrainerProfile | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private readonly trainersService: TrainersService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Trainer ID is missing.';
      this.loading = false;
      return;
    }

    this.trainersService.getById(id).subscribe({
      next: (trainer) => {
        this.trainer = trainer;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this trainer.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatNickname(): string {
    return displayValue(this.trainer?.nickname);
  }

  formatAccount(): string {
    if (!this.trainer) {
      return '—';
    }
    return this.trainer.accountId ? 'Linked' : 'Unlinked';
  }
}
