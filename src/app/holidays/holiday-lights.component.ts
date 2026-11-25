import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HolidayService } from './holiday.service';

/**
 * Over Christmas, a string of lights along the top of the navigation (the sidebar and the phone's
 * top bar), glowing slowly in turn. Decorative: `aria-hidden`, no pointer, no glow with reduced
 * motion. The parent positions it (`position: relative` or sticky).
 */
@Component({
  selector: 'app-holiday-lights',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (holidays.christmas()) {
      <div class="lights" aria-hidden="true" data-testid="holiday-lights">
        @for (bulb of bulbs; track bulb) {
          <span
            class="lights__bulb"
            [class]="'lights__bulb--' + (bulb % 4)"
          ></span>
        }
      </div>
    }
  `,
  styleUrl: './holiday-lights.component.scss',
})
export class HolidayLightsComponent {
  readonly holidays = inject(HolidayService);
  /** Enough for the widest top bar; the ones past the edge are cut off. */
  readonly bulbs = Array.from({ length: 64 }, (_, index) => index);
}
