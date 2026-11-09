import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ChipComponent, ChipTone } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { UiMessage, apiErrorMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  RenewalRow,
  SubscriptionRenewals,
  SubscriptionRenewalsService,
} from '../../services/subscription-renewals.service';

export type RenewalTab = 'punch' | 'time';

/** A table column: header key, cell text and whether it is a number. */
interface RenewalColumn {
  header: string;
  value: (row: RenewalRow) => string;
  numeric?: boolean;
}

/** One section of a tab (exhausted or active), with how to show its rows. */
export interface RenewalSectionView {
  id: string;
  title: string;
  subtitle: string;
  empty: string;
  rows: RenewalRow[];
  columns: RenewalColumn[];
  /** Mobile rows: the key figure as a chip, and a second line. */
  chip: (row: RenewalRow) => string;
  chipTone: (row: RenewalRow) => ChipTone;
  meta: (row: RenewalRow) => string;
}

/**
 * Renewals: active trainees by subscription state, so trainers see who has run out of paid
 * trainings and who runs out next. Two tabs (punch, time), each with an exhausted and an active
 * section. The API decides who goes where and in which order; this page only shows it.
 */
@Component({
  selector: 'app-renewals',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    AvatarComponent,
    ChipComponent,
    EmptyStateComponent,
    IconComponent,
    ListRowComponent,
    PageHeaderComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './renewals.component.html',
})
export class RenewalsComponent implements OnInit {
  private readonly renewalsService = inject(SubscriptionRenewalsService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly i18n = inject(LanguageService);
  private readonly format = inject(LocaleFormatService);

  readonly tabOptions: SegmentedOption<RenewalTab>[] = [
    { value: 'punch', label: 'enums.planType.PUNCH' },
    { value: 'time', label: 'enums.planType.TIME' },
  ];
  tab: RenewalTab = 'punch';
  renewals: SubscriptionRenewals | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    this.renewalsService.overview().subscribe({
      next: (renewals) => {
        this.renewals = renewals;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'renewals.loadErrorMessage');
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** The sections of the chosen tab: exhausted first, then active. */
  get sections(): RenewalSectionView[] {
    if (!this.renewals) {
      return [];
    }
    return this.tab === 'punch'
      ? this.punchSections(this.renewals)
      : this.timeSections(this.renewals);
  }

  /** Nickname in the language's quotes (“Gosho” / „Гошо“) for the title suffix. */
  quotedNickname(value: string | null): string {
    return value ? this.i18n.t('common.quoted', { text: value }) : '';
  }

  private punchSections(renewals: SubscriptionRenewals): RenewalSectionView[] {
    const lastTraining = this.lastTrainingColumn();
    return [
      {
        id: 'punch-exhausted',
        title: 'renewals.punch.exhaustedTitle',
        subtitle: 'renewals.punch.exhaustedSub',
        empty: 'renewals.punch.exhaustedEmpty',
        rows: renewals.punch.exhausted,
        columns: [
          this.planColumn(),
          {
            header: 'renewals.fields.unpaid',
            value: (row) => this.format.number(row.unpaidTrainings),
            numeric: true,
          },
          lastTraining,
        ],
        chip: (row) =>
          this.i18n.t('renewals.values.unpaidChip', {
            count: row.unpaidTrainings,
          }),
        // Used up with nothing owed yet: no alarm colour.
        chipTone: (row) => (row.unpaidTrainings > 0 ? 'danger' : 'neutral'),
        meta: (row) => this.planText(row),
      },
      {
        id: 'punch-active',
        title: 'renewals.punch.activeTitle',
        subtitle: 'renewals.punch.activeSub',
        empty: 'renewals.punch.activeEmpty',
        rows: renewals.punch.active,
        columns: [
          this.planColumn(),
          {
            header: 'renewals.fields.left',
            value: (row) => this.format.number(row.remainingCredits ?? 0),
            numeric: true,
          },
          lastTraining,
        ],
        chip: (row) =>
          this.i18n.t('renewals.values.leftChip', {
            count: row.remainingCredits ?? 0,
          }),
        chipTone: () => 'neutral',
        meta: (row) => this.planText(row),
      },
    ];
  }

  private timeSections(renewals: SubscriptionRenewals): RenewalSectionView[] {
    return [
      {
        id: 'time-exhausted',
        title: 'renewals.time.exhaustedTitle',
        subtitle: 'renewals.time.exhaustedSub',
        empty: 'renewals.time.exhaustedEmpty',
        rows: renewals.time.exhausted,
        columns: [
          this.planColumn(),
          {
            header: 'renewals.fields.endedOn',
            value: (row) => this.format.date(row.endsAt),
          },
          {
            header: 'renewals.fields.expired',
            value: (row) => this.daysAgo(row),
            numeric: true,
          },
          {
            header: 'renewals.fields.unpaid',
            value: (row) => this.format.number(row.unpaidTrainings),
            numeric: true,
          },
        ],
        chip: (row) => this.daysAgo(row),
        chipTone: () => 'danger',
        meta: (row) =>
          `${this.planText(row)} · ${this.i18n.t('renewals.values.unpaidChip', {
            count: row.unpaidTrainings,
          })}`,
      },
      {
        id: 'time-active',
        title: 'renewals.time.activeTitle',
        subtitle: 'renewals.time.activeSub',
        empty: 'renewals.time.activeEmpty',
        rows: renewals.time.active,
        columns: [
          this.planColumn(),
          {
            header: 'renewals.fields.endsOn',
            value: (row) => this.format.date(row.endsAt),
          },
          {
            header: 'renewals.fields.daysLeft',
            value: (row) =>
              this.i18n.t('renewals.values.daysLeft', {
                count: row.daysLeft ?? 0,
              }),
            numeric: true,
          },
          this.lastTrainingColumn(),
        ],
        chip: (row) =>
          this.i18n.t('renewals.values.daysLeftChip', {
            count: row.daysLeft ?? 0,
          }),
        chipTone: () => 'neutral',
        meta: (row) =>
          `${this.planText(row)} · ${this.format.date(row.endsAt)}`,
      },
    ];
  }

  private planColumn(): RenewalColumn {
    return {
      header: 'renewals.fields.plan',
      value: (row) => this.planText(row),
    };
  }

  private lastTrainingColumn(): RenewalColumn {
    return {
      header: 'renewals.fields.lastTraining',
      value: (row) => this.format.date(row.lastTrainedAt),
    };
  }

  /** The plan, plus how many subscriptions are running when there are several. */
  private planText(row: RenewalRow): string {
    return row.activeSubscriptions > 1
      ? `${row.planTitle} · ${this.i18n.t('renewals.values.subscriptions', {
          count: row.activeSubscriptions,
        })}`
      : row.planTitle;
  }

  private daysAgo(row: RenewalRow): string {
    return this.i18n.t('renewals.values.daysAgo', {
      count: row.daysSinceEnd ?? 0,
    });
  }
}
