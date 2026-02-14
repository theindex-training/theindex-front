import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  GenerateSettlementPayload,
  Settlement,
  SettlementsService
} from '../../services/settlements.service';

@Component({
  selector: 'app-settlements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settlements.component.html',
  styleUrl: './settlements.component.scss'
})
export class SettlementsComponent implements OnInit {
  settlements: Settlement[] = [];

  periodStart = this.todayIsoDate();
  periodEnd = this.todayIsoDate();

  loading = true;
  generating = false;
  errorMessage = '';
  generationError = '';

  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSettlements();
  }

  loadSettlements(): void {
    this.loading = true;
    this.errorMessage = '';

    this.settlementsService.list().subscribe({
      next: (settlements) => {
        this.settlements = settlements;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load settlements right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  generateSettlement(): void {
    this.generationError = '';

    if (!this.periodStart || !this.periodEnd) {
      this.generationError = 'Please provide both period start and period end.';
      return;
    }

    const payload: GenerateSettlementPayload = {
      periodStart: this.periodStart,
      periodEnd: this.periodEnd
    };

    this.generating = true;

    this.settlementsService.generate(payload).subscribe({
      next: (response) => {
        this.generating = false;
        this.settlements = [response.settlement, ...this.settlements];
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.generationError =
          error?.error?.message || 'Unable to generate a settlement report right now.';
        this.generating = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  private todayIsoDate(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
