import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GymLocationsService } from '../../services/gym-locations.service';
import {
  Settlement,
  SettlementAllocation,
  SettlementLine,
  SettlementsService
} from '../../services/settlements.service';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

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

  trainers: TrainerProfile[] = [];
  trainerLabelById = new Map<string, string>();
  traineeNameById = new Map<string, string>();
  locationNameById = new Map<string, string>();

  selectedTrainerId = '';

  loading = true;
  loadingAllocations = true;
  loadingEntities = true;
  finalizing = false;
  isAdmin = false;
  errorMessage = '';
  allocationError = '';

  private settlementId = '';

  constructor(
    private readonly authService: AuthService,
    private readonly settlementsService: SettlementsService,
    private readonly trainersService: TrainersService,
    private readonly traineesService: TraineesService,
    private readonly gymLocationsService: GymLocationsService,
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
    this.isAdmin = this.authService.getUserRole() === 'ADMIN';
    this.loadEntities();
    this.loadSettlement();
    this.loadAllocations();
  }

  loadSettlement(): void {
    this.loading = true;
    this.errorMessage = '';

    this.settlementsService.getById(this.settlementId).subscribe({
      next: response => {
        this.settlement = response.settlement;
        this.lines = response.lines;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
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
        next: response => {
          this.allocations = response.rows;
          this.allocationsTotal = response.total;
          this.loadingAllocations = false;
          this.changeDetector.detectChanges();
        },
        error: error => {
          this.allocationError = error?.error?.message || 'Unable to load allocation rows right now.';
          this.loadingAllocations = false;
          this.changeDetector.detectChanges();
        }
      });
  }

  finalizeSettlement(): void {
    if (!this.isAdmin || !this.settlement || this.settlement.status !== 'DRAFT') {
      return;
    }

    this.finalizing = true;

    this.settlementsService.finalize(this.settlement.id).subscribe({
      next: settlement => {
        this.settlement = settlement;
        this.finalizing = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'Unable to finalize this settlement report.';
        this.finalizing = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatTrainer(trainerId: string): string {
    return this.trainerLabelById.get(trainerId) || trainerId;
  }

  formatTrainee(traineeId: string | undefined): string {
    if (!traineeId) {
      return '—';
    }

    return this.traineeNameById.get(traineeId) || traineeId;
  }

  formatGym(locationId: string | null | undefined): string {
    if (!locationId) {
      return '—';
    }

    return this.locationNameById.get(locationId) || locationId;
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

  private loadEntities(): void {
    this.loadingEntities = true;

    if (this.isAdmin) {
      this.trainersService.list().subscribe({
        next: trainers => {
          this.trainers = trainers;
          this.trainerLabelById = new Map(
            trainers.map(trainer => [trainer.id, trainer.nickname?.trim() || trainer.name])
          );
          this.changeDetector.detectChanges();
        },
        error: () => {
          this.changeDetector.detectChanges();
        }
      });

      this.traineesService.list().subscribe({
        next: (trainees: TraineeProfile[]) => {
          this.traineeNameById = new Map(trainees.map(trainee => [trainee.id, trainee.name]));
          this.changeDetector.detectChanges();
        },
        error: () => {
          this.changeDetector.detectChanges();
        }
      });
    }

    this.gymLocationsService.list(true).subscribe({
      next: locations => {
        this.locationNameById = new Map(locations.map(location => [location.id, location.name]));
        this.loadingEntities = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.loadingEntities = false;
        this.changeDetector.detectChanges();
      }
    });
  }
}
