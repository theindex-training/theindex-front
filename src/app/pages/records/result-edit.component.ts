import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin, of } from 'rxjs';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { LanguageService } from '../../i18n/language.service';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  Benchmark,
  BenchmarkResult,
  BenchmarksService,
} from '../../services/benchmarks.service';
import { localDayKey } from '../../utils/calendar.util';
import {
  applyScoreRules,
  buildResultForm,
  fillFromResult,
  RESULT_NOTE_MAX,
  ResultForm,
  resultPayload,
  ScoreRules,
} from './result-form';
import { clock, scoringText } from './score-format';

/**
 * Logs a result (`/records/:id/log`) or changes one of the person's own (`/records/:id/results/
 * :resultId`): the day, the score in the benchmark's terms (time, or the reps done when capped;
 * rounds and reps; reps; kg), Rx or scaled (benchmarks only) and an optional note. Nobody checks
 * it: people are trusted. Saving goes back to the benchmark's page, or to the Mine tab of the
 * records when the edit was opened from there (`?from=mine`).
 */
@Component({
  selector: 'app-result-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './result-edit.component.html',
  styles: `
    // Minutes and seconds are one field: a fieldset without the browser's frame.
    // Side by side on phones too: they are short numbers.
    .result-time {
      grid-auto-columns: minmax(0, 1fr);
      grid-auto-flow: column;
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .result-time > legend {
      margin-bottom: var(--space-2);
      padding: 0;
    }
  `,
})
export class ResultEditComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly form: ResultForm;
  readonly today: string;
  readonly noteMax = RESULT_NOTE_MAX;

  benchmarkId = '';
  resultId: string | null = null;
  /** Opened from the Mine tab of the records (`?from=mine`): back and saving go there. */
  fromMine = false;
  benchmark: Benchmark | null = null;
  result: BenchmarkResult | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly benchmarks: BenchmarksService,
    private readonly language: LanguageService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.today = localDayKey(new Date()) ?? '';
    this.form = buildResultForm(formBuilder, this.today);
  }

  get isNew(): boolean {
    return this.resultId === null;
  }

  get rules(): ScoreRules | null {
    return this.benchmark
      ? {
          scoreType: this.benchmark.scoreType,
          timeCapSeconds: this.benchmark.timeCapSeconds,
        }
      : null;
  }

  /** A UrlTree, so `?tab=mine` stays a query parameter. */
  get backLink(): UrlTree {
    return this.fromMine
      ? this.router.createUrlTree(['/records'], {
          queryParams: { tab: 'mine' },
        })
      : this.router.createUrlTree(['/records', this.benchmarkId]);
  }

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.benchmarkId = params.get('id') ?? '';
    this.resultId = params.get('resultId');
    this.fromMine = this.route.snapshot.queryParamMap.get('from') === 'mine';

    this.form.controls.capped.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.rules) {
          applyScoreRules(this.form, this.rules);
        }
      });

    forkJoin({
      benchmark: this.benchmarks.getById(this.benchmarkId),
      result: this.resultId
        ? this.benchmarks.getResult(this.resultId)
        : of(null),
    }).subscribe({
      next: ({ benchmark, result }) => {
        this.benchmark = benchmark;
        this.result = result;
        if (result) {
          fillFromResult(this.form, result);
        }
        applyScoreRules(this.form, this.rules!);
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'records.form.loadError');
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

  timeCap(): string {
    return clock(this.benchmark?.timeCapSeconds ?? 0);
  }

  showError(name: keyof ResultForm['controls']): boolean {
    const control = this.form.controls[name];
    return control.enabled && control.touched && control.invalid;
  }

  /** The time's own error (missing, or over the cap), once a part of it was touched. */
  timeError(): 'time' | 'overCap' | null {
    const { minutes, seconds } = this.form.controls;
    if (!(minutes.touched || seconds.touched) || !minutes.enabled) {
      return null;
    }
    if (minutes.invalid || seconds.invalid || this.form.hasError('time')) {
      return 'time';
    }
    return this.form.hasError('overCap') ? 'overCap' : null;
  }

  handleSubmit(): void {
    if (this.submitting || !this.benchmark) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    const payload = resultPayload(this.form, this.rules!);
    const request = this.resultId
      ? this.benchmarks.updateResult(this.resultId, payload)
      : this.benchmarks.createResult({
          benchmarkId: this.benchmark.id,
          ...payload,
        });

    request.subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigateByUrl(this.backLink);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'records.form.saveError');
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
