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
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { HolidayService } from './holiday.service';
import { Snowfall } from './snowfall';

/** How long a celebration's line stays. */
const CELEBRATION_MS = 4500;
/** New Year: how often a single rocket goes up on the dashboard after the day's show. */
const ROCKET_INTERVAL = 30_000;

/**
 * The holidays' layer over every page (in the app root, so the sign-in page has it too): the
 * falling snow while the effects are on and the OS doesn't ask for less motion, and the line of a
 * celebration (a booking, a personal best) with a puff of snow (confetti over Christmas,
 * fireworks at New Year). From Dec 31 to Jan 2 it also plays a short fireworks show once a day
 * (after the сурвачка's wish is closed) and sends a rocket up now and then on the dashboard. It
 * never takes a click
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
  private readonly ready = signal(false);
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly router = inject(Router);
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      const intensity = this.holidays.snowIntensity();
      if (canvas && this.view && !this.snowfall) {
        this.snowfall = new Snowfall(canvas, this.view);
        this.ready.set(true);
      } else if (!canvas && this.snowfall) {
        this.snowfall.destroy();
        this.snowfall = null;
        this.ready.set(false);
      }
      this.snowfall?.setIntensity(intensity);
    });

    // New Year: the day's show, once the canvas is up and the сурвачка's wish is closed.
    effect(() => {
      if (
        this.ready() &&
        !this.holidays.survachkaOpen() &&
        this.holidays.takeFireworksShow()
      ) {
        this.snowfall?.show();
      }
    });

    const rockets = setInterval(() => {
      if (
        this.snowfall &&
        this.view &&
        this.holidays.newYear() &&
        !this.holidays.survachkaOpen() &&
        this.path() === '/home'
      ) {
        this.snowfall.rocket(
          this.view.innerWidth * (0.2 + Math.random() * 0.6),
          this.view.innerHeight * (0.15 + Math.random() * 0.25),
        );
      }
    }, ROCKET_INTERVAL);

    effect(() => {
      const celebration = this.holidays.celebration();
      if (!celebration) {
        return;
      }
      if (celebration.key) {
        this.line.set(celebration.key);
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => this.line.set(null), CELEBRATION_MS);
      }
      if (this.snowfall && this.view) {
        // From where it happened, else just above the line at the bottom middle of the window.
        const { x, y } = celebration.origin ?? {
          x: this.view.innerWidth / 2,
          y: this.view.innerHeight - 140,
        };
        if (celebration.burst === 'confetti') {
          this.snowfall.confetti(x, y);
        } else if (celebration.burst === 'fireworks') {
          this.snowfall.fireworks(x, y - 80);
        } else {
          this.snowfall.burst(x, y);
        }
      }
    });

    inject(DestroyRef).onDestroy(() => {
      clearInterval(rockets);
      clearTimeout(this.hideTimer);
      this.snowfall?.destroy();
    });
  }
}
