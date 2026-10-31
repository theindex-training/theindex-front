import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrainingTime, TrainingTimesService } from '../../services/training-times.service';
import { formatTimeWithoutSeconds } from '../../utils/time-display';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-training-time-delete',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, PageHeaderComponent],
  templateUrl: './training-time-delete.component.html'
})
export class TrainingTimeDeleteComponent implements OnInit {
  trainingTime: TrainingTime | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly trainingTimesService: TrainingTimesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('trainingTimes.errors.missingId');
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
        this.errorMessage = apiErrorMessage(error, 'trainingTimes.errors.load');
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
    this.errorMessage = null;

    this.trainingTimesService.delete(this.trainingTime.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/training-times']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'trainingTimes.delete.error');
        this.submitting = false;
      }
    });
  }

  formatTime(value: string): string {
    return formatTimeWithoutSeconds(value);
  }
}
