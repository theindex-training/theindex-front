import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { IconComponent } from '../../components/icon/icon.component';
import {
  Settlement,
  SettlementsService,
} from '../../services/settlements.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
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
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './settlements.component.html',
})
/**
 * The settlement reports, latest period first. The API creates one per half month, so there is no
 * create or delete action here: staff open a report to review it, and an admin finalizes it there.
 */
export class SettlementsComponent implements OnInit {
  readonly format = inject(LocaleFormatService);
  settlements: Settlement[] = [];

  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadSettlements();
  }

  loadSettlements(): void {
    this.loading = true;
    this.errorMessage = null;

    this.settlementsService.list().subscribe({
      next: (settlements) => {
        this.settlements = settlements;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'settlements.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  formatDate(date: string): string {
    return this.format.dateTime(date);
  }
}
