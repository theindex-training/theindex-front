import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChipComponent } from '../../../components/chip/chip.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { ListRowComponent } from '../../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { SearchFieldComponent } from '../../../components/search-field/search-field.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../../components/skeleton-list/skeleton-list.component';
import { StatusDotComponent } from '../../../components/status-dot/status-dot.component';
import { EnumLabelPipe } from '../../../i18n/enum-label.pipe';
import { LanguageService } from '../../../i18n/language.service';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import {
  Benchmark,
  BenchmarksService,
} from '../../../services/benchmarks.service';
import { scoringText } from '../../records/score-format';
import { WorkoutsNavComponent } from '../workouts-nav.component';

type KindFilter = 'all' | 'BENCHMARK' | 'LIFT';

/**
 * The catalogue of benchmarks and heavy lifts (ADMIN, TRAINER). Everything is loaded once; the
 * search and the kind filter work on it.
 */
@Component({
  selector: 'app-benchmarks',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
    WorkoutsNavComponent,
    SearchFieldComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ListRowComponent,
    IconComponent,
    ChipComponent,
    StatusDotComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './benchmarks.component.html',
})
export class BenchmarksComponent implements OnInit {
  readonly kindOptions: SegmentedOption<KindFilter>[] = [
    { value: 'all', label: 'common.all' },
    { value: 'BENCHMARK', label: 'records.tabs.benchmarks' },
    { value: 'LIFT', label: 'records.tabs.lifts' },
  ];

  benchmarks: Benchmark[] = [];
  filtered: Benchmark[] = [];
  term = '';
  kind: KindFilter = 'all';
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly benchmarksService: BenchmarksService,
    private readonly language: LanguageService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    this.benchmarksService.list().subscribe({
      next: (benchmarks) => {
        this.benchmarks = benchmarks;
        this.applyFilters();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.benchmarks.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** By kind, and part of the name or of a movement's name, ignoring case. */
  applyFilters(): void {
    const term = this.term.trim().toLowerCase();
    this.filtered = this.benchmarks.filter(
      (benchmark) =>
        (this.kind === 'all' || benchmark.kind === this.kind) &&
        (!term ||
          [benchmark.name, ...benchmark.exercises.map((e) => e.name)].some(
            (name) => name.toLowerCase().includes(term),
          )),
    );
  }

  clearFilters(): void {
    this.term = '';
    this.kind = 'all';
    this.applyFilters();
  }

  scoring(benchmark: Benchmark): string {
    return scoringText(benchmark, (key, params) =>
      this.language.t(key, params),
    );
  }
}
