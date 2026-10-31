import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { IconComponent } from '../../components/icon/icon.component';
import { AuthService } from '../../services/auth.service';
import { Settlement, SettlementsService } from '../../services/settlements.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { LanguageService } from '../../i18n/language.service';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';

@Component({
  selector: 'app-settlements',
  standalone: true,
  imports: [
    EnumLabelPipe, 
    UiMessagePipe, 
    TranslocoPipe, 
    RouterLink,
    PageHeaderComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ChipComponent,
    ListRowComponent,
    IconComponent
  ],
  templateUrl: './settlements.component.html'
})
export class SettlementsComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);
  settlements: Settlement[] = [];

  loading = true;
  errorMessage: UiMessage | null = null;
  deletingSettlementId: string | null = null;
  canManageSettlements = false;

  constructor(
    private readonly authService: AuthService,
    private readonly settlementsService: SettlementsService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canManageSettlements = this.authService.getUserRole() === 'ADMIN';
    this.loadSettlements();
  }

  loadSettlements(): void {
    this.loading = true;
    this.errorMessage = null;

    this.settlementsService.list().subscribe({
      next: settlements => {
        this.settlements = settlements;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage = apiErrorMessage(error, 'settlements.list.loadErrorMessage');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  deleteSettlement(settlement: Settlement): void {
    if (!this.canManageSettlements) {
      return;
    }

    if (this.deletingSettlementId) {
      return;
    }

    const confirmed = window.confirm(
      this.i18n.t('settlements.list.confirmDelete', {
        start: this.format.date(settlement.periodStart),
        end: this.format.date(settlement.periodEnd)
      })
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
        this.errorMessage = apiErrorMessage(error, 'settlements.list.deleteError');
        this.deletingSettlementId = null;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatDate(date: string): string {
    return this.format.dateTime(date);
  }
}
