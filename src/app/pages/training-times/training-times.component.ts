import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TrainingTime, TrainingTimesService } from '../../services/training-times.service';

@Component({
  selector: 'app-training-times',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './training-times.component.html',
  styleUrl: './training-times.component.scss'
})
export class TrainingTimesComponent implements OnInit {
  trainingTimes: TrainingTime[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    private readonly trainingTimesService: TrainingTimesService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTrainingTimes();
  }

  loadTrainingTimes(): void {
    this.loading = true;
    this.errorMessage = '';

    this.trainingTimesService.list().subscribe({
      next: (trainingTimes) => {
        this.trainingTimes = trainingTimes;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load training times right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }
}
