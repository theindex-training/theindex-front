import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HolidayService } from './holiday.service';
import { Snowfall } from './snowfall';

/** How long a celebration's line stays. */
const CELEBRATION_MS = 4500;
/** December's snowfall is light; later occasions can raise it. */
const DECEMBER_INTENSITY = 0.6;

/**
 * The holidays' layer over every page (in the app root, so the sign-in page has it too): the
 * falling snow while the effects are on and the OS doesn't ask for less motion, and the line of a
 * celebration (a booking, a personal best) with a puff of snow. It never takes a click
 * (`pointer-events: none`) and is hidden from assistive technology, except the line, which is
 * announced politely.
 */
@Component({
  selector: 'app-holiday-layer',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (falling()) {
      <canvas
        #canvas
        class="holiday-layer__snow"
        aria-hidden="true"
        data-testid="holiday-snow"
      ></canvas>
    }
    <div class="holiday-layer__line-region" aria-live="polite">
      @if (line(); as key) {
        <p class="holiday-layer__line" data-testid="holiday-celebration">
          {{ key | transloco }}
        </p>
      }
    </div>
  `,
  styleUrl: './holiday-layer.component.scss',
})
export class HolidayLayerComponent {
  private readonly holidays = inject(HolidayService);
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  /** Falling snow: the effects on and motion allowed. */
  readonly falling = computed(
    () => this.holidays.effects() && !this.holidays.reducedMotion(),
  );
  /** The celebration's line being shown, as a translation key. */
  readonly line = signal<string | null>(null);

  private snowfall: Snowfall | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      if (canvas && this.view && !this.snowfall) {
        this.snowfall = new Snowfall(canvas, this.view);
        this.snowfall.setIntensity(DECEMBER_INTENSITY);
      } else if (!canvas && this.snowfall) {
        this.snowfall.destroy();
        this.snowfall = null;
      }
    });

    effect(() => {
      const celebration = this.holidays.celebration();
      if (!celebration) {
        return;
      }
      this.line.set(celebration.key);
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.line.set(null), CELEBRATION_MS);
      if (this.snowfall && this.view) {
        // From just above the line, at the bottom middle of the window.
        this.snowfall.burst(
          this.view.innerWidth / 2,
          this.view.innerHeight - 140,
        );
      }
    });

    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.hideTimer);
      this.snowfall?.destroy();
    });
  }
}
