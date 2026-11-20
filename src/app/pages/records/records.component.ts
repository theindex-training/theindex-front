import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { ChipComponent } from '../../components/chip/chip.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SearchFieldComponent } from '../../components/search-field/search-field.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { AuthService } from '../../services/auth.service';
import {
  BenchmarkOverview,
  BenchmarkResult,
  BenchmarksService,
} from '../../services/benchmarks.service';
import { BenchmarkCardComponent } from './benchmark-card.component';
import { canLogResults } from './records-access';
import { scoreText } from './score-format';

export type RecordsTab = 'benchmarks' | 'lifts' | 'mine';

const TABS: RecordsTab[] = ['benchmarks', 'lifts', 'mine'];

/**
 * Records (`/records`, everyone): benchmark workouts and heavy lifts in two tabs, each a card
 * with the top of its Rx and scaled leaderboards, and, for people who log results, a third tab
 * with their own results, which they edit or delete there. `?tab=` keeps the tab in the address.
 */
@Component({
  selector: 'app-records',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    SegmentedControlComponent,
    SearchFieldComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ChipComponent,
    IconComponent,
    BenchmarkCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './records.component.html',
  styles: `
    .cards {
      display: grid;
      gap: var(--space-4);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    @media (min-width: 1024px) {
      .cards {
        grid-template-columns: repeat(auto-fill, minmax(26rem, 1fr));
      }
    }

    .result__note {
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .result__chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-1);
    }

    // On phones the buttons get their own line under the score, so the name keeps its width.
    .my-result {
      flex-wrap: wrap;
    }

    .result__actions {
      display: flex;
      flex-basis: 100%;
      justify-content: flex-end;
      gap: var(--space-1);
    }

    @media (min-width: 768px) {
      .my-result {
        flex-wrap: nowrap;
      }

      .result__actions {
        flex-basis: auto;
        flex-shrink: 0;
      }
    }
  `,
})
export class RecordsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly canLog: boolean;
  readonly tabOptions: SegmentedOption<RecordsTab>[];

  tab: RecordsTab = 'benchmarks';
  items: BenchmarkOverview[] = [];
  filtered: BenchmarkOverview[] = [];
  results: BenchmarkResult[] = [];
  term = '';
  loading = true;
  errorMessage: UiMessage | null = null;
  /** A failed delete on the Mine tab, shown above the list. */
  actionError: UiMessage | null = null;
  deletingId: string | null = null;
  private request?: Subscription;

  constructor(
    auth: AuthService,
    private readonly benchmarks: BenchmarksService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.canLog = canLogResults(auth);
    this.tabOptions = [
      { value: 'benchmarks', label: 'records.tabs.benchmarks' },
      { value: 'lifts', label: 'records.tabs.lifts' },
      ...(this.canLog
        ? [{ value: 'mine' as const, label: 'records.tabs.mine' }]
        : []),
    ];
  }

  ngOnInit(): void {
    // The page is reused when only `?tab=` changes.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const tab = params.get('tab') as RecordsTab | null;
        this.tab =
          tab && TABS.includes(tab) && (tab !== 'mine' || this.canLog)
            ? tab
            : 'benchmarks';
        this.load();
      });
  }

  selectTab(tab: RecordsTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'benchmarks' ? null : tab },
    });
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.errorMessage = null;
    this.actionError = null;
    const failed = (error: unknown) => {
      this.errorMessage = apiErrorMessage(error, 'records.loadErrorMessage');
      this.loading = false;
      this.changeDetector.detectChanges();
    };

    if (this.tab === 'mine') {
      this.request = this.benchmarks.myResults().subscribe({
        next: (results) => {
          this.results = results;
          this.loading = false;
          this.changeDetector.detectChanges();
        },
        error: failed,
      });
      return;
    }
    this.request = this.benchmarks
      .overview(this.tab === 'lifts' ? 'LIFT' : 'BENCHMARK')
      .subscribe({
        next: (items) => {
          this.items = items;
          this.applySearch();
          this.loading = false;
          this.changeDetector.detectChanges();
        },
        error: failed,
      });
  }

  /** By name or movement, ignoring case. */
  applySearch(): void {
    const term = this.term.trim().toLowerCase();
    this.filtered = term
      ? this.items.filter((item) =>
          [item.name, ...item.exercises.map((e) => e.name)].some((name) =>
            name.toLowerCase().includes(term),
          ),
        )
      : this.items;
  }

  clearSearch(): void {
    this.term = '';
    this.applySearch();
  }

  /**
   * Deletes one of the person's results after asking. The list is then asked for again without
   * the skeleton, since another result may become the personal best.
   */
  deleteResult(result: BenchmarkResult): void {
    const params = {
      name: result.benchmark.name,
      day: this.day(result.performedOn),
    };
    if (
      this.deletingId ||
      !window.confirm(this.language.t('records.mine.deleteConfirm', params))
    ) {
      return;
    }
    this.deletingId = result.id;
    this.actionError = null;
    this.benchmarks.deleteResult(result.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.results = this.results.filter((item) => item.id !== result.id);
        this.changeDetector.detectChanges();
        this.request?.unsubscribe();
        this.request = this.benchmarks.myResults().subscribe({
          next: (results) => {
            this.results = results;
            this.changeDetector.detectChanges();
          },
        });
      },
      error: (error) => {
        this.actionError = apiErrorMessage(error, 'records.mine.deleteError');
        this.deletingId = null;
        this.changeDetector.detectChanges();
      },
    });
  }

  score(result: BenchmarkResult): string {
    return scoreText(result, result.benchmark.scoreType, {
      t: (key, params) => this.language.t(key, params),
      number: (value) => this.format.number(value),
    });
  }

  day(value: string): string {
    return this.format.date(value);
  }
}
