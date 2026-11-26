import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HolidayService } from './holiday.service';
import { SurvachkaComponent } from './survachka.component';

/**
 * The сурвачка's New Year wish (Jan 1 – 6): a modal dialog that opens by itself the first time
 * the app is opened in the new year, and again when the сурвачка on the logo is tapped. The
 * сурвачка taps the logo seven times, then the rhyme. Closing it remembers it was seen. In the
 * navigation shell (`app-main-layout`), so it greets signed-in people.
 */
@Component({
  selector: 'app-survachka-dialog',
  standalone: true,
  imports: [TranslocoPipe, SurvachkaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './survachka-dialog.component.html',
  styleUrl: './survachka-dialog.component.scss',
})
export class SurvachkaDialogComponent {
  readonly holidays = inject(HolidayService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  /** The seven taps play (restarted every time the wish opens). */
  readonly tapping = signal(false);

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (dialog && this.holidays.survachkaOpen() && !dialog.open) {
        dialog.showModal();
        this.tapping.set(!this.holidays.reducedMotion());
      }
    });
  }

  close(): void {
    this.dialog()?.nativeElement.close();
  }

  /** Closed by its button, Escape or the backdrop. */
  handleClose(): void {
    this.tapping.set(false);
    this.holidays.closeSurvachka();
  }

  handleDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }
}
