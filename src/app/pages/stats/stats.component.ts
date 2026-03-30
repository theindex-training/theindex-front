import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { TraineeTrainingInsights, TraineesService } from '../../services/trainees.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent implements OnInit {
  loading = true;
  errorMessage = '';
  insights: TraineeTrainingInsights | null = null;

  constructor(
    private readonly traineesService: TraineesService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInsights();
  }

  private loadInsights(): void {
    this.loading = true;
    this.errorMessage = '';

    this.traineesService.getMyTrainingInsights().subscribe({
      next: insights => {
        this.insights = insights;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage =
          error?.error?.message || 'Unable to load your training stats right now. Please try again later.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }
}
