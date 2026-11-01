import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';

import { displayValue } from '../../utils/display.util';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { LanguageService } from '../../i18n/language.service';

@Component({
  selector: 'app-trainee-delete',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, PageHeaderComponent],
  templateUrl: './trainee-delete.component.html'
})
export class TraineeDeleteComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  trainee: TraineeProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly traineesService: TraineesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('trainees.errors.missingId');
      this.loading = false;
      return;
    }

    this.traineesService.getById(id).subscribe({
      next: (trainee) => {
        this.trainee = trainee;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          apiErrorMessage(error, 'trainees.errors.load');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  confirmDeactivate(): void {
    if (!this.trainee) {
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    this.traineesService.deactivate(this.trainee.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainees']);
      },
      error: (error) => {
        this.errorMessage =
          apiErrorMessage(error, 'trainees.delete.error');
        this.submitting = false;
      }
    });
  }

  formatNickname(): string {
    return displayValue(this.trainee?.nickname);
  }

  formatPhone(): string {
    return displayValue(this.trainee?.phone);
  }

  formatAccount(): string {
    return this.i18n.t(this.trainee?.accountId ? 'common.linked' : 'common.notLinked');
  }
}
