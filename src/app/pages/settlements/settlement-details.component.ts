import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Settlement,
  SettlementAllocation,
  SettlementLine,
  SettlementsService
} from '../../services/settlements.service';

@Component({
  selector: 'app-settlement-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settlement-details.component.html',
  styleUrl: './settlement-details.component.scss'
})
export class SettlementDetailsComponent implements OnInit {
  settlement: Settlement | null = null;
  lines: SettlementLine[] = [];
  allocations: SettlementAllocation[] = [];
  allocationsTotal = 0;

  selectedTrainerId = '';

  loading = true;
  loadingAllocations = true;
  finalizing = false;
  errorMessage = '';
  allocationError = '';

  private settlementId = '';

  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Settlement ID is missing.';
      this.loading = false;
      return;
    }

    this.settlementId = id;
    this.loadSettlement();
    this.loadAllocations();
  }

  loadSettlement(): void {
    this.loading = true;
    this.errorMessage = '';

    this.settlementsService.getById(this.settlementId).subscribe({
      next: (response) => {
        this.settlement = response.settlement;
        this.lines = response.lines;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load this settlement report.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  loadAllocations(): void {
    this.loadingAllocations = true;
    this.allocationError = '';

    this.settlementsService
      .allocations(this.settlementId, {
        trainerId: this.selectedTrainerId || undefined,
        offset: 0,
        limit: 50
      })
      .subscribe({
        next: (response) => {
          this.allocations = response.rows;
          this.allocationsTotal = response.total;
          this.loadingAllocations = false;
          this.changeDetector.detectChanges();
        },
        error: (error) => {
          this.allocationError =
            error?.error?.message || 'Unable to load allocation rows right now.';
          this.loadingAllocations = false;
          this.changeDetector.detectChanges();
        }
      });
  }

  finalizeSettlement(): void {
    if (!this.settlement || this.settlement.status !== 'DRAFT') {
      return;
    }

    this.finalizing = true;

    this.settlementsService.finalize(this.settlement.id).subscribe({
      next: (settlement) => {
        this.settlement = settlement;
        this.finalizing = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to finalize this settlement report.';
        this.finalizing = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  trainerIds(): string[] {
    return Array.from(new Set(this.lines.map(line => line.trainerId)));
  }

  formatCurrency(valueCents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(valueCents / 100);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  formatOptionalDate(date: string | undefined): string {
    return date ? this.formatDate(date) : '—';
  }
}
