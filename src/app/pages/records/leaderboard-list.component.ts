import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { IconComponent } from '../../components/icon/icon.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import {
  BenchmarkScoreType,
  LeaderboardEntry,
} from '../../services/benchmarks.service';
import { scoreText } from './score-format';

/**
 * A ranked list of results (presentational): rank, the person's photo (or initials) and name,
 * score, day and note. The signed-in
 * person's own row is marked. With `canDelete` (admins), each row has a delete button; the page
 * asks and deletes.
 */
@Component({
  selector: 'app-leaderboard-list',
  standalone: true,
  imports: [TranslocoPipe, AvatarComponent, ChipComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (entries.length) {
      <ol class="board" [attr.aria-label]="label">
        @for (entry of entries; track entry.resultId) {
          <li
            class="board__row"
            [class.is-me]="entry.isMe"
            [attr.data-testid]="'leaderboard-' + entry.resultId"
          >
            <span class="board__rank num" aria-hidden="true">{{
              entry.rank
            }}</span>
            <app-avatar
              class="board__avatar"
              [name]="entry.name"
              [photoUrl]="entry.photoUrl"
            />
            <div class="board__main">
              <span class="board__name">
                <span class="visually-hidden">{{
                  'records.board.rank' | transloco: { rank: entry.rank }
                }}</span>
                {{ entry.name }}
                @if (entry.isMe) {
                  <app-chip tone="accent">{{
                    'records.board.you' | transloco
                  }}</app-chip>
                }
                @if (entry.personType === 'TRAINER') {
                  <app-chip tone="neutral">{{
                    'records.board.coach' | transloco
                  }}</app-chip>
                }
              </span>
              <span class="board__meta">{{ day(entry.performedOn) }}</span>
              @if (entry.note) {
                <span class="board__note" [textContent]="entry.note"></span>
              }
            </div>
            <span class="board__score num" data-testid="leaderboard-score">{{
              score(entry)
            }}</span>
            @if (canDelete) {
              <button
                class="icon-btn icon-btn--danger"
                type="button"
                [attr.aria-label]="
                  'records.board.delete' | transloco: { name: entry.name }
                "
                (click)="remove.emit(entry)"
              >
                <app-icon name="trash" />
              </button>
            }
          </li>
        }
      </ol>
    } @else {
      <p class="board__empty text-muted">{{ emptyText }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }

    .board {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .board__row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-top: 1px solid var(--border);

      &:first-child {
        border-top: 0;
      }
    }

    .board__row.is-me {
      margin: 0 calc(-1 * var(--space-2));
      padding-inline: var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
    }

    .board__rank {
      flex: 0 0 2rem;
      color: var(--accent-text);
      font-family: var(--font-heading);
      font-size: var(--text-lg);
      font-weight: 700;
      text-align: center;
    }

    .board__avatar {
      --avatar-size: 2.5rem;
      --avatar-radius: var(--radius-md);
      --avatar-font-size: var(--text-sm);
    }

    .board__main {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .board__name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1) var(--space-2);
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .board__meta,
    .board__note {
      color: var(--muted);
      font-size: var(--text-sm);
    }

    .board__note {
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .board__score {
      font-weight: 600;
      text-align: right;
    }

    .board__empty {
      margin: 0;
    }

    // In a narrow list (a card on a phone), the score goes under the name.
    @container (max-width: 22rem) {
      .board__row {
        flex-wrap: wrap;
        // Rank and avatar, and the gaps after them.
        --board-lead: calc(2rem + 2.5rem + 2 * var(--space-3));
      }

      .board__main {
        flex-basis: calc(100% - var(--board-lead));
      }

      .board__score {
        order: 1;
        flex-basis: 100%;
        padding-left: var(--board-lead);
        text-align: left;
      }
    }
  `,
})
export class LeaderboardListComponent {
  @Input({ required: true }) entries: LeaderboardEntry[] = [];
  @Input({ required: true }) scoreType!: BenchmarkScoreType;
  /** The list's accessible name (translated text). */
  @Input({ required: true }) label = '';
  /** Shown when nobody is on it (translated text). */
  @Input({ required: true }) emptyText = '';
  @Input() canDelete = false;
  @Output() readonly remove = new EventEmitter<LeaderboardEntry>();

  constructor(
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
  ) {}

  score(entry: LeaderboardEntry): string {
    return scoreText(entry, this.scoreType, {
      t: (key, params) => this.language.t(key, params),
      number: (value) => this.format.number(value),
    });
  }

  day(value: string): string {
    return this.format.date(value);
  }
}
