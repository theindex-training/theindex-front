import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TrainingTime, TrainingTimesService } from '../../services/training-times.service';
import { formatTimeWithoutSeconds } from '../../utils/time-display';

@Component({
  selector: 'app-training-time-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './training-time-details.component.html',
  styleUrl: './training-time-details.component.scss'
})
export class TrainingTimeDetailsComponent implements OnInit {
  trainingTime: TrainingTime | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private readonly trainingTimesService: TrainingTimesService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Training time ID is missing.';
      this.loading = false;
      return;
    }

    this.trainingTimesService.getById(id).subscribe({
      next: (trainingTime) => {
        this.trainingTime = trainingTime;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load this training time.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatTime(value: string): string {
    return formatTimeWithoutSeconds(value);
  }
}
