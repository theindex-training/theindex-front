import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';

@Component({
  selector: 'app-settlement-details',
  standalone: true,
  imports: [EnumLabelPipe, UiMessagePipe, TranslocoPipe, CommonModule, FormsModule, RouterLink, PageHeaderComponent, SkeletonListComponent, ChipComponent, AvatarComponent],
  templateUrl: './settlement-details.component.html',
  styleUrl: './settlement-details.component.scss'
})
export class SettlementDetailsComponent implements OnInit {
  readonly format = inject(LocaleFormatService);
  settlement: Settlement | null = null;
  lines: SettlementLine[] = [];
  allocations: SettlementAllocation[] = [];
  allocationsTotal = 0;

  trainers: TrainerProfile[] = [];
  trainerLabelById = new Map<string, string>();
  traineeLabelById = new Map<string, string>();
  locationNameById = new Map<string, string>();

  selectedTrainerId = '';

  loading = true;
  loadingAllocations = true;
  loadingEntities = true;
  finalizing = false;
  isAdmin = false;
  errorMessage: UiMessage | null = null;
  allocationError: UiMessage | null = null;

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
      this.errorMessage = i18nMessage('settlements.errors.missingId');
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
    this.errorMessage = null;

    this.settlementsService.getById(this.settlementId).subscribe({
      next: response => {
        this.settlement = response.settlement;
        this.lines = response.lines;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage = apiErrorMessage(error, 'settlements.details.loadError');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  loadAllocations(): void {
    this.loadingAllocations = true;
    this.allocationError = null;

    this.settlementsService
      .allocations(this.settlementId, {
        trainerId: this.selectedTrainerId || undefined,
        offset: 0,
        limit: 500
      })
      .subscribe({
        next: response => {
          this.allocations = response.rows;
          this.allocationsTotal = response.total;
          this.loadingAllocations = false;
          this.changeDetector.detectChanges();
        },
        error: error => {
          this.allocationError = apiErrorMessage(error, 'settlements.details.loadAllocationsError');
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
        this.errorMessage = apiErrorMessage(error, 'settlements.details.finalizeError');
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

    return this.traineeLabelById.get(traineeId) || traineeId;
  }

  formatGym(locationId: string | null | undefined): string {
    if (!locationId) {
      return '—';
    }

    return this.locationNameById.get(locationId) || locationId;
  }

  formatCurrency(valueCents: number): string {
    return this.format.money(valueCents);
  }

  formatDate(date: string): string {
    return this.format.dateTime(date);
  }

  formatOptionalDate(date: string | undefined): string {
    return date ? this.formatDate(date) : '—';
  }

  private formatTraineeLabel(trainee: TraineeProfile): string {
    const nickname = trainee.nickname?.trim();

    return nickname ? `${trainee.name} (${nickname})` : trainee.name;
  }

  private loadEntities(): void {
    this.loadingEntities = true;

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
        this.traineeLabelById = new Map(
          trainees.map(trainee => [trainee.id, this.formatTraineeLabel(trainee)])
        );
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.changeDetector.detectChanges();
      }
    });

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
