import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A сурвачка: the decorated cornel branch Bulgarian children tap people's backs with on New
 * Year's Day, wishing them health and luck. Decorative only (`aria-hidden`); the parent sizes it
 * with `width` and animates it.
 */
@Component({
  selector: 'app-survachka',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 80 110" aria-hidden="true">
      <path
        class="wood"
        d="M70 108C64 80 60 60 52 44 40 20 14 10 10 30s20 28 30 10c8-14-4-24-12-16"
      />
      <path class="thread thread--red" d="m58 64-14 22m10-32L38 72" />
      <path class="thread thread--white" d="m60 70-10 24" />
      <circle class="popcorn" cx="14" cy="22" r="4.5" />
      <circle class="popcorn" cx="24" cy="48" r="4.5" />
      <circle class="popcorn" cx="46" cy="30" r="4" />
      <circle class="fruit fruit--gold" cx="9" cy="38" r="5" />
      <circle class="fruit fruit--red" cx="36" cy="12" r="4.5" />
      <circle class="coin" cx="44" cy="88" r="6" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }

    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .wood {
      fill: none;
      stroke: var(--survachka-wood);
      stroke-width: 5;
      stroke-linecap: round;
    }

    .thread {
      stroke-width: 2.4;
      stroke-linecap: round;
    }

    .thread--red {
      stroke: var(--holiday-red);
    }

    .thread--white {
      stroke: var(--snow-fill);
    }

    .popcorn {
      fill: var(--survachka-popcorn);
      stroke: var(--snow-edge);
    }

    .fruit--gold,
    .coin {
      fill: var(--holiday-gold);
    }

    .fruit--red {
      fill: var(--holiday-red);
    }
  `,
})
export class SurvachkaComponent {}
