import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin, of } from 'rxjs';
import { ChipComponent } from '../../components/chip/chip.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { AuthService } from '../../services/auth.service';
import {
  Benchmark,
  BenchmarkResult,
  BenchmarksService,
  Leaderboard,
  LeaderboardEntry,
} from '../../services/benchmarks.service';
import { ExerciseVideoComponent } from '../trainee-schedule/exercise-video.component';
import { LeaderboardListComponent } from './leaderboard-list.component';
import { canLogResults } from './records-access';
import { scoreText, scoringText } from './score-format';

/**
 * A benchmark's or heavy lift's page (`/records/:id`, everyone): what it is (description,
 * movements with their descriptions and videos, for beginners), its whole Rx and scaled
 * leaderboards, and the signed-in person's own results, which they edit or delete. Admins can
 * delete anyone's result from the leaderboards.
 */
@Component({
  selector: 'app-benchmark-detail',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    ChipComponent,
    IconComponent,
    ExerciseVideoComponent,
    LeaderboardListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './benchmark-detail.component.html',
  styleUrl: './benchmark-detail.component.scss',
})
export class BenchmarkDetailComponent implements OnInit {
  readonly canLog: boolean;
  readonly isAdmin: boolean;

  benchmarkId = '';
  benchmark: Benchmark | null = null;
  board: Leaderboard = { rx: [], scaled: [] };
  mine: BenchmarkResult[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;
  /** A failed delete, shown above the lists. */
  actionError: UiMessage | null = null;
  deletingId: string | null = null;

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
    this.isAdmin = auth.getUserRole() === 'ADMIN';
    this.backLink = router.createUrlTree(['/records']);
  }

  ngOnInit(): void {
    this.benchmarkId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  get isBenchmark(): boolean {
    return this.benchmark?.kind === 'BENCHMARK';
  }

  /**
   * Back to the records tab it is on. A UrlTree, so `?tab=` stays a query parameter (in a string
   * the "?" would be encoded into the path). Set once the benchmark is known.
   */
  backLink: UrlTree;

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    forkJoin({
      benchmark: this.benchmarks.getById(this.benchmarkId),
      board: this.benchmarks.leaderboard(this.benchmarkId),
      mine: this.canLog
        ? this.benchmarks.myResults(this.benchmarkId)
        : of([] as BenchmarkResult[]),
    }).subscribe({
      next: ({ benchmark, board, mine }) => {
        this.benchmark = benchmark;
        this.backLink = this.router.createUrlTree(['/records'], {
          queryParams: benchmark.kind === 'LIFT' ? { tab: 'lifts' } : {},
        });
        this.board = board;
        this.mine = mine;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'records.detail.loadError');
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  scoring(): string {
    return this.benchmark
      ? scoringText(this.benchmark, (key, params) =>
          this.language.t(key, params),
        )
      : '';
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

  boardLabel(key: string): string {
    return this.language.t('records.board.label', {
      list: this.language.t(key),
      name: this.benchmark?.name ?? '',
    });
  }

  /** An admin removes someone's result from the leaderboard (their next best takes its place). */
  deleteEntry(entry: LeaderboardEntry): void {
    const question = this.language.t('records.detail.deleteEntryConfirm', {
      name: entry.name,
    });
    this.deleteResult(entry.resultId, question);
  }

  deleteMine(result: BenchmarkResult): void {
    const question = this.language.t('records.detail.deleteMineConfirm', {
      day: this.day(result.performedOn),
    });
    this.deleteResult(result.id, question);
  }

  private deleteResult(id: string, question: string): void {
    if (this.deletingId || !window.confirm(question)) {
      return;
    }
    this.deletingId = id;
    this.actionError = null;
    this.benchmarks.deleteResult(id).subscribe({
      next: () => {
        this.deletingId = null;
        this.load();
      },
      error: (error) => {
        this.actionError = apiErrorMessage(error, 'records.detail.deleteError');
        this.deletingId = null;
        this.changeDetector.detectChanges();
      },
    });
  }
}
