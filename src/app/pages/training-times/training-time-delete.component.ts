import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TrainingTime, TrainingTimesService } from '../../services/training-times.service';

@Component({
  selector: 'app-training-time-delete',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './training-time-delete.component.html',
  styleUrl: './training-time-delete.component.scss'
})
export class TrainingTimeDeleteComponent implements OnInit {
  trainingTime: TrainingTime | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly trainingTimesService: TrainingTimesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
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

  confirmDelete(): void {
    if (!this.trainingTime) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.trainingTimesService.delete(this.trainingTime.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/training-times']);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to delete this training time right now.';
        this.submitting = false;
      }
    });
  }
}
