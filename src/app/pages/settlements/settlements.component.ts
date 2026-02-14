import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Settlement, SettlementsService } from '../../services/settlements.service';

@Component({
  selector: 'app-settlements',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './settlements.component.html',
  styleUrl: './settlements.component.scss'
})
export class SettlementsComponent implements OnInit {
  settlements: Settlement[] = [];

  loading = true;
  errorMessage = '';
  deletingSettlementId: string | null = null;

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
      next: settlements => {
        this.settlements = settlements;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'Unable to load settlements right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  deleteSettlement(settlement: Settlement): void {
    if (this.deletingSettlementId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete settlement for ${settlement.periodStart} to ${settlement.periodEnd}?`
    );

    if (!confirmed) {
      return;
    }

    this.deletingSettlementId = settlement.id;

    this.settlementsService.delete(settlement.id).subscribe({
      next: () => {
        this.settlements = this.settlements.filter(item => item.id !== settlement.id);
        this.deletingSettlementId = null;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'Unable to delete settlement right now.';
        this.deletingSettlementId = null;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }
}
