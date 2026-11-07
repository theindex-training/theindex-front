import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** What to ask; all three are translation keys. */
export interface ConfirmRequest {
  title: string;
  message: string;
  confirm: string;
}

/**
 * A confirmation for a dangerous action (unpublish, delete, discard): a modal <dialog> with the
 * consequence spelled out, Cancel first (and focused) and a solid danger button. `ask()` resolves
 * true only when the admin confirms; Escape, the backdrop and Cancel answer false.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- a click on the backdrop cancels; keyboard users have Escape and the Cancel button -->
    <dialog
      #dialog
      class="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      (close)="handleClose()"
      (click)="handleDialogClick($event)"
    >
      @if (request; as current) {
        <h2 class="confirm-dialog__title" id="confirm-dialog-title">
          {{ current.title | transloco }}
        </h2>
        <p class="confirm-dialog__message" id="confirm-dialog-message">
          {{ current.message | transloco }}
        </p>
        <div class="form-actions">
          <button
            #cancel
            class="btn btn--secondary"
            type="button"
            (click)="answer(false)"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            class="btn btn--danger-solid"
            type="button"
            (click)="answer(true)"
          >
            {{ current.confirm | transloco }}
          </button>
        </div>
      }
    </dialog>
  `,
  styles: `
    .confirm-dialog {
      width: calc(100% - 2 * var(--space-4));
      max-width: 32rem;
      padding: var(--space-6);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-md);
    }

    .confirm-dialog::backdrop {
      background: var(--scrim);
    }

    .confirm-dialog__title {
      margin: 0 0 var(--space-3);
      font-size: var(--text-2xl);
    }

    .confirm-dialog__message {
      margin: 0 0 var(--space-6);
      color: var(--muted);
    }
  `,
})
export class ConfirmDialogComponent implements OnDestroy {
  request: ConfirmRequest | null = null;

  @ViewChild('dialog', { static: true })
  private readonly dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('cancel')
  private readonly cancelButton?: ElementRef<HTMLButtonElement>;
  private resolveAsk: ((confirmed: boolean) => void) | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private confirmed = false;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  ask(request: ConfirmRequest): Promise<boolean> {
    this.resolveAsk?.(false);
    this.request = request;
    this.confirmed = false;
    this.returnFocusTo = document.activeElement as HTMLElement | null;
    this.changeDetector.detectChanges();
    if (!this.dialog.nativeElement.open) {
      this.dialog.nativeElement.showModal();
    }
    // The safe choice has the focus, so Enter right away cancels.
    this.cancelButton?.nativeElement.focus();
    return new Promise((resolve) => {
      this.resolveAsk = resolve;
    });
  }

  answer(confirmed: boolean): void {
    this.confirmed = confirmed;
    if (this.dialog.nativeElement.open) {
      this.dialog.nativeElement.close();
    } else {
      this.handleClose();
    }
  }

  // Fires for every close: the buttons, Escape and a backdrop click.
  handleClose(): void {
    const resolve = this.resolveAsk;
    this.resolveAsk = null;
    resolve?.(this.confirmed);
    this.confirmed = false;
    this.returnFocusTo?.focus();
    this.returnFocusTo = null;
  }

  handleDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog.nativeElement) {
      this.answer(false);
    }
  }

  ngOnDestroy(): void {
    this.resolveAsk?.(false);
    this.resolveAsk = null;
  }
}
