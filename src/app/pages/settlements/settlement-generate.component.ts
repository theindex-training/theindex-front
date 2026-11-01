import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  GenerateSettlementPayload,
  SettlementsService
} from '../../services/settlements.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-settlement-generate',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './settlement-generate.component.html'
})
export class SettlementGenerateComponent {
  periodStart = this.todayIsoDate();
  periodEnd = this.todayIsoDate();

  generating = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  generateSettlement(): void {
    this.errorMessage = null;

    if (!this.periodStart || !this.periodEnd) {
      this.errorMessage = i18nMessage('settlements.generate.missingDates');
      return;
    }

    const payload: GenerateSettlementPayload = {
      periodStart: this.periodStart,
      periodEnd: this.periodEnd
    };

    this.generating = true;

    this.settlementsService.generate(payload).subscribe({
      next: response => {
        this.generating = false;
        this.router.navigate(['/settlements', response.settlement.id]);
      },
      error: error => {
        this.errorMessage = apiErrorMessage(error, 'settlements.generate.error');
        this.generating = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  private todayIsoDate(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
