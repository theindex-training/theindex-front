import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import {
  BenchmarkOverview,
  LeaderboardEntry,
} from '../../services/benchmarks.service';
import { LeaderboardListComponent } from './leaderboard-list.component';
import { scoreText, scoringText } from './score-format';

/**
 * One benchmark or heavy lift on the records page (presentational): how it is scored, its
 * movements, the top of its Rx and scaled leaderboards (one list for a lift), the signed-in
 * person's own places, and links to log a result and to see everything.
 */
@Component({
  selector: 'app-benchmark-card',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, LeaderboardListComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <article
      class="panel card"
      [attr.aria-labelledby]="'benchmark-' + item.id"
      [attr.data-testid]="'benchmark-card-' + item.id"
    >
      <header class="card__header">
        <h2 class="card__title" [id]="'benchmark-' + item.id">
          <a [routerLink]="['/records', item.id]">{{ item.name }}</a>
        </h2>
        <p class="card__meta">{{ scoring() }}</p>
        @if (item.kind === 'BENCHMARK' && item.exercises.length) {
          <p class="card__meta">{{ movements() }}</p>
        }
      </header>

      @if (!item.rxCount && !item.scaledCount) {
        <p class="card__empty text-muted">
          {{ 'records.board.empty' | transloco }}
        </p>
      } @else {
        <div class="card__boards" [class.card__boards--two]="isBenchmark">
          <section class="card__board">
            <h3 class="card__board-title">
              {{
                (isBenchmark ? 'records.rx' : 'records.board.title') | transloco
              }}
              <span class="text-muted">{{
                'records.people' | transloco: { count: item.rxCount }
              }}</span>
            </h3>
            <app-leaderboard-list
              [entries]="item.rx"
              [scoreType]="item.scoreType"
              [label]="
                boardLabel(isBenchmark ? 'records.rx' : 'records.board.title')
              "
              [emptyText]="'records.board.empty' | transloco"
            />
          </section>
          @if (isBenchmark) {
            <section class="card__board">
              <h3 class="card__board-title">
                {{ 'records.scaled' | transloco }}
                <span class="text-muted">{{
                  'records.people' | transloco: { count: item.scaledCount }
                }}</span>
              </h3>
              <app-leaderboard-list
                [entries]="item.scaled"
                [scoreType]="item.scoreType"
                [label]="boardLabel('records.scaled')"
                [emptyText]="'records.board.emptyScaled' | transloco"
              />
            </section>
          }
        </div>
      }

      @if (canLog && (item.myRx || item.myScaled)) {
        <p class="card__mine" data-testid="benchmark-card-mine">
          @if (item.myRx; as mine) {
            <span>{{
              myLine(isBenchmark ? 'records.myRx' : 'records.myBest', mine)
            }}</span>
          }
          @if (item.myScaled; as mine) {
            <span>{{ myLine('records.myScaled', mine) }}</span>
          }
        </p>
      }

      <div class="card__actions">
        <a class="btn btn--ghost" [routerLink]="['/records', item.id]">{{
          'records.seeAll' | transloco
        }}</a>
        @if (canLog) {
          <a
            class="btn btn--secondary"
            [routerLink]="['/records', item.id, 'log']"
            >{{ 'records.log' | transloco }}</a
          >
        }
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      container-type: inline-size;
    }

    .card {
      display: grid;
      gap: var(--space-4);
      height: 100%;
      align-content: start;
    }

    .card__header {
      display: grid;
      gap: var(--space-1);
    }

    .card__title,
    .card__meta,
    .card__board-title,
    .card__mine,
    .card__empty {
      margin: 0;
    }

    .card__title {
      font-size: var(--text-xl);

      a {
        color: var(--text);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }
    }

    .card__meta {
      color: var(--muted);
      font-size: var(--text-sm);
    }

    .card__boards {
      display: grid;
      gap: var(--space-4);
    }

    .card__board {
      display: grid;
      gap: var(--space-2);
      align-content: start;
    }

    .card__board-title {
      display: flex;
      justify-content: space-between;
      gap: var(--space-2);
      font-size: var(--text-base);
    }

    .card__mine {
      display: grid;
      gap: var(--space-1);
      font-weight: 600;
    }

    .card__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-2);
      align-self: end;

      .btn {
        flex: 1 1 auto;
      }
    }

    // Rx and scaled side by side only when the card is wide enough for both.
    @container (min-width: 40rem) {
      .card__boards--two {
        grid-template-columns: 1fr 1fr;
      }

      .card__actions .btn {
        flex: 0 0 auto;
      }
    }
  `,
})
export class BenchmarkCardComponent {
  @Input({ required: true }) item!: BenchmarkOverview;
  /** The signed-in person logs results of their own. */
  @Input() canLog = false;

  constructor(
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
  ) {}

  get isBenchmark(): boolean {
    return this.item.kind === 'BENCHMARK';
  }

  scoring(): string {
    return scoringText(this.item, (key, params) =>
      this.language.t(key, params),
    );
  }

  movements(): string {
    return this.item.exercises.map((e) => e.name).join(' · ');
  }

  boardLabel(key: string): string {
    return this.language.t('records.board.label', {
      list: this.language.t(key),
      name: this.item.name,
    });
  }

  /** "Your Rx best: 4:26 (#2)". */
  myLine(key: string, entry: LeaderboardEntry): string {
    return this.language.t(key, {
      score: scoreText(entry, this.item.scoreType, {
        t: (k, params) => this.language.t(k, params),
        number: (value) => this.format.number(value),
      }),
      rank: entry.rank,
    });
  }
}
