import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Plan, PlansService } from '../../services/plans.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { StatusDotComponent } from '../../components/status-dot/status-dot.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { LanguageService } from '../../i18n/language.service';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { planIncludes } from './plan-duration';

@Component({
  selector: 'app-plan-details',
  standalone: true,
  imports: [
    EnumLabelPipe,
    UiMessagePipe,
    TranslocoPipe,
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    StatusDotComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './plan-details.component.html',
})
export class PlanDetailsComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);
  plan: Plan | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly plansService: PlansService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('plans.errors.missingId');
      this.loading = false;
      return;
    }

    this.plansService.getById(id).subscribe({
      next: (plan) => {
        this.plan = plan;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'plans.errors.load');
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  formatPrice(priceCents: number): string {
    return this.format.money(priceCents);
  }

  formatPlanDetails(plan: Plan): string {
    const { key, count } = planIncludes(plan);
    return this.i18n.t(key, { count });
  }
}
