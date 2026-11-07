import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { apiErrorMessage, UiMessage } from '../../../../i18n/ui-message';
import {
  Article,
  SaveDraftChanges,
  SaveDraftPayload,
} from '../../../../services/articles.service';

export type DraftField = keyof SaveDraftChanges;

/**
 * - `saved`: nothing waits to be saved.
 * - `pending`: changes wait for the debounce.
 * - `saving`: a save is on its way.
 * - `invalid`: the valid changes are saved; a field with an error waits until it is fixed.
 * - `error`: the last save failed; the changes are kept and go with the next save.
 * - `conflict`: the draft was saved elsewhere (409). Nothing more is saved until a reload.
 */
export type SaveStatus =
  'saved' | 'pending' | 'saving' | 'invalid' | 'error' | 'conflict';

export interface CollectedChanges {
  changes: SaveDraftChanges;
  /** Fields that can't be sent as they are (too long, a bad slug). */
  invalid: DraftField[];
}

export interface DraftAutosaveOptions {
  /** The draft revision the page loaded. */
  revision: number;
  /** Wait this long after the last change (about 2 seconds in the editor). */
  delayMs: number;
  /** The values to send for these fields, read at save time. */
  collect: (fields: ReadonlySet<DraftField>) => Promise<CollectedChanges>;
  send: (payload: SaveDraftPayload) => Observable<Article>;
  /** After every successful save, with the API's answer. */
  saved?: (article: Article) => void;
}

/**
 * Autosave for the article editor (theindex-web docs/decision-record.md, section 9): only the
 * fields that changed, about 2 seconds after the last change, one request at a time, each based
 * on the revision the last one returned. A change made while a save is on its way goes with the
 * next one. On a 409 it stops, so a stale tab never overwrites newer work.
 */
export class DraftAutosave {
  readonly status = signal<SaveStatus>('saved');
  /** Why the last save failed (`error` and `conflict`). */
  readonly error = signal<UiMessage | null>(null);

  private revisionValue: number;
  private readonly dirty = new Set<DraftField>();
  private readonly invalid = new Set<DraftField>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<boolean> | null = null;
  private stopped = false;

  constructor(private readonly options: DraftAutosaveOptions) {
    this.revisionValue = options.revision;
  }

  get revision(): number {
    return this.revisionValue;
  }

  /** Something the leave guard and `beforeunload` must not lose. */
  get hasUnsavedChanges(): boolean {
    return (
      this.dirty.size > 0 || this.invalid.size > 0 || this.inFlight !== null
    );
  }

  /** A field changed: save it after the delay (restarted by every change). */
  change(field: DraftField): void {
    if (this.stopped) {
      return;
    }
    this.invalid.delete(field);
    this.dirty.add(field);
    if (!this.inFlight) {
      this.status.set('pending');
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), this.options.delayMs);
  }

  /**
   * Saves now (after a save on its way, if any). True when everything is saved. Used by "Try
   * again" and when leaving the page.
   */
  save(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.stopped) {
      return Promise.resolve(false);
    }
    if (this.inFlight) {
      return this.inFlight.then(() => this.save());
    }
    for (const field of this.invalid) {
      this.dirty.add(field);
    }
    this.invalid.clear();
    if (!this.dirty.size) {
      return Promise.resolve(this.status() === 'saved');
    }
    this.inFlight = this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Stops for good: the page is closing. */
  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private async run(): Promise<boolean> {
    const fields = new Set(this.dirty);
    this.dirty.clear();
    this.status.set('saving');

    let collected: CollectedChanges;
    try {
      collected = await this.options.collect(fields);
    } catch {
      return this.failed(fields, null);
    }
    const sendable = Object.keys(collected.changes).length > 0;

    if (sendable) {
      try {
        const article = await firstValueFrom(
          this.options.send({
            ...collected.changes,
            baseRevision: this.revisionValue,
          }),
        );
        this.revisionValue = article.draftRevision;
        this.error.set(null);
        this.options.saved?.(article);
      } catch (error) {
        return this.failed(fields, error);
      }
    }

    for (const field of collected.invalid) {
      this.invalid.add(field);
    }
    if (this.dirty.size) {
      // Changed while saving: those go with the next save.
      this.status.set('pending');
      this.timer = setTimeout(() => void this.save(), this.options.delayMs);
    } else {
      this.status.set(this.invalid.size ? 'invalid' : 'saved');
    }
    return !this.invalid.size && !this.dirty.size;
  }

  private failed(fields: Set<DraftField>, error: unknown): false {
    for (const field of fields) {
      this.dirty.add(field);
    }
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.stop();
      this.status.set('conflict');
      this.error.set(
        apiErrorMessage(error, 'content.articles.editor.save.conflict'),
      );
    } else {
      this.status.set('error');
      this.error.set(
        apiErrorMessage(error, 'content.articles.editor.save.error'),
      );
    }
    return false;
  }
}
