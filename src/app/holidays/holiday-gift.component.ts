import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HolidayService } from './holiday.service';

/** How long the lid takes to fly off before the greeting shows (specs use 0). */
export const GIFT_OPEN_DELAY = new InjectionToken<number>('GIFT_OPEN_DELAY', {
  providedIn: 'root',
  factory: () => 600,
});

/** Each day's greeting (Dec 20 – 27), in both language files. */
const GREETINGS: Record<number, string> = {
  20: 'holidays.gift.greetings.d20',
  21: 'holidays.gift.greetings.d21',
  22: 'holidays.gift.greetings.d22',
  23: 'holidays.gift.greetings.d23',
  24: 'holidays.gift.greetings.d24',
  25: 'holidays.gift.greetings.d25',
  26: 'holidays.gift.greetings.d26',
  27: 'holidays.gift.greetings.d27',
};

/**
 * Over Christmas (Dec 20 – 27), a small gift hides next to the title of one page a day
 * (`GIFT_PAGES`, by role). Opening it throws confetti and shows the day's greeting; once found it
 * is gone until tomorrow's. Every page title has one (`app-page-header`); it shows only on today's
 * page.
 */
@Component({
  selector: 'app-holiday-gift',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './holiday-gift.component.html',
  styleUrl: './holiday-gift.component.scss',
})
export class HolidayGiftComponent {
  private readonly holidays = inject(HolidayService);
  private readonly role = inject(AuthService).getUserRole();
  private readonly openDelay = inject(GIFT_OPEN_DELAY);
  private readonly router = inject(Router);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  /** The current page's path, without the query. */
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Being opened: the button stays (the lid flies off) until the greeting is closed. */
  readonly opening = signal(false);
  /** The day whose greeting the dialog shows. */
  readonly shownDay = signal<number | null>(null);

  readonly here = computed(
    () =>
      this.opening() ||
      this.holidays.giftPage(this.role) === this.path().split(/[?#]/)[0],
  );

  greeting(day: number): string {
    return GREETINGS[day] ?? GREETINGS[20];
  }

  open(event: MouseEvent): void {
    const day = this.holidays.giftDay();
    if (day === null || this.opening()) {
      return;
    }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.opening.set(true);
    this.shownDay.set(day);
    this.holidays.openGift({
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    });
    if (this.openDelay && !this.holidays.reducedMotion()) {
      setTimeout(() => this.showDialog(), this.openDelay);
    } else {
      this.showDialog();
    }
  }

  close(): void {
    this.dialog()?.nativeElement.close();
  }

  /** The dialog closed (its button, Escape or the backdrop): the gift is gone. */
  handleClose(): void {
    this.opening.set(false);
  }

  handleDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }

  private showDialog(): void {
    const dialog = this.dialog()?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }
}
