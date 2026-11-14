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
import { Plan, PlansService } from '../../services/plans.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { LanguageService } from '../../i18n/language.service';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';

@Component({
  selector: 'app-plans',
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
  templateUrl: './plans.component.html',
})
export class PlansComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);
  plans: Plan[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly plansService: PlansService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.errorMessage = null;

    // Deleting a plan only deactivates it, so the list asks for the active ones: the others are
    // gone as far as the app is concerned.
    this.plansService.list(true).subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'plans.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  formatPrice(priceCents: number): string {
    return this.format.money(priceCents);
  }

  formatPlanDetails(plan: Plan): string {
    if (plan.type === 'PUNCH') {
      return this.i18n.t('plans.fields.creditsCount', {
        count: plan.credits ?? 0,
      });
    }
    return this.i18n.t('plans.fields.daysCount', {
      count: plan.durationDays ?? 0,
    });
  }
}
