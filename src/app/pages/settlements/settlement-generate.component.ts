import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  GenerateSettlementPayload,
  SettlementsService
} from '../../services/settlements.service';

@Component({
  selector: 'app-settlement-generate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settlement-generate.component.html',
  styleUrl: './settlement-generate.component.scss'
})
export class SettlementGenerateComponent {
  periodStart = this.todayIsoDate();
  periodEnd = this.todayIsoDate();

  generating = false;
  errorMessage = '';

  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  generateSettlement(): void {
    this.errorMessage = '';

    if (!this.periodStart || !this.periodEnd) {
      this.errorMessage = 'Please provide both period start and period end.';
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
        this.errorMessage = error?.error?.message || 'Unable to generate settlement report right now.';
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
