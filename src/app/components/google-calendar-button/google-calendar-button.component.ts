import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * "Add to Google Calendar" in Google's own button style (its white or dark surface, grey outline,
 * mixed-case label and the Google Calendar mark from `public/brand/google-calendar.svg`), since
 * people know it from other sites. A link to `href` (a Google Calendar event template) in a new
 * tab.
 */
@Component({
  selector: 'app-google-calendar-button',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <a
      class="google-calendar-button"
      data-testid="google-calendar-button"
      target="_blank"
      rel="noopener noreferrer"
      [href]="href"
    >
      <img
        class="google-calendar-button__mark"
        src="/brand/google-calendar.svg"
        alt=""
        width="20"
        height="20"
      />
      <span
        >{{ 'googleCalendar.add' | transloco }}
        <span class="visually-hidden">{{
          'googleCalendar.opensInNewTab' | transloco
        }}</span></span
      >
    </a>
  `,
  styleUrl: './google-calendar-button.component.scss',
})
export class GoogleCalendarButtonComponent {
  @Input({ required: true }) href = '';
}
