import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * "Add to Apple Calendar" in Apple's button style (black in light mode, white in dark, the system
 * font, mixed case), with a calendar tile showing the training's weekday and day, as Apple's
 * Calendar icon shows the date. A link to `href`, the training's `.ics` file: an iPhone or iPad
 * offers to add it to Calendar, a Mac opens it in Calendar. It opens in the same tab, since the
 * file is downloaded rather than shown.
 */
@Component({
  selector: 'app-apple-calendar-button',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <a
      class="apple-calendar-button"
      data-testid="apple-calendar-button"
      [href]="href"
    >
      <span class="apple-calendar-button__tile" aria-hidden="true">
        <span class="apple-calendar-button__weekday">{{ weekday }}</span>
        <span class="apple-calendar-button__day">{{ day }}</span>
      </span>
      <span
        >{{ 'appleCalendar.add' | transloco }}
        <span class="visually-hidden">{{
          'appleCalendar.downloadsFile' | transloco
        }}</span></span
      >
    </a>
  `,
  styleUrl: './apple-calendar-button.component.scss',
})
export class AppleCalendarButtonComponent {
  @Input({ required: true }) href = '';
  /** The training's weekday, short ("Tue"), for the tile. */
  @Input({ required: true }) weekday = '';
  /** The training's day of the month ("17"), for the tile. */
  @Input({ required: true }) day = '';
}
