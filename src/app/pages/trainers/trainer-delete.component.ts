import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

import { displayValue } from '../../utils/display.util';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { LanguageService } from '../../i18n/language.service';

@Component({
  selector: 'app-trainer-delete',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, PageHeaderComponent],
  templateUrl: './trainer-delete.component.html'
})
export class TrainerDeleteComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  trainer: TrainerProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly trainersService: TrainersService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('trainers.errors.missingId');
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
          apiErrorMessage(error, 'trainers.errors.load');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  confirmDeactivate(): void {
    if (!this.trainer) {
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    this.trainersService.deactivate(this.trainer.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainers']);
      },
      error: (error) => {
        this.errorMessage =
          apiErrorMessage(error, 'trainers.delete.error');
        this.submitting = false;
      }
    });
  }

  formatNickname(): string {
    return displayValue(this.trainer?.nickname);
  }

  formatAccount(): string {
    return this.i18n.t(this.trainer?.accountId ? 'common.linked' : 'common.notLinked');
  }
}
