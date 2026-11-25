import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../components/icon/icon.component';
import { HolidayService } from './holiday.service';

/**
 * "Holiday effects" on/off for the navigation shell (sidebar footer and the phone's sheet), shown
 * only while the effects run (Dec 1 – Jan 6). Off stops the snow, the snow caps and the
 * celebrations for this season; the Advent calendar stays. The choice is forgotten after the
 * holidays, so next December starts with the effects on.
 */
@Component({
  selector: 'app-holiday-switch',
  standalone: true,
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (holidays.state().december) {
      <label class="holiday-switch">
        <app-icon name="snowflake" />
        <span class="holiday-switch__label">{{
          'holidays.effects' | transloco
        }}</span>
        <input
          class="holiday-switch__input"
          type="checkbox"
          role="switch"
          [checked]="holidays.effectsOn()"
          (change)="toggle($event)"
        />
        <span class="holiday-switch__track" aria-hidden="true"></span>
      </label>
    }
  `,
  styleUrl: './holiday-switch.component.scss',
})
export class HolidaySwitchComponent {
  readonly holidays = inject(HolidayService);

  toggle(event: Event): void {
    this.holidays.setEffects((event.target as HTMLInputElement).checked);
  }
}
