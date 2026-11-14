import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Under a field the admin is filling in: the value the existing profile already stores, when it
 * differs from what the field holds, with a button that puts it in the field.
 */
@Component({
  selector: 'app-field-difference',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <p
      class="field-difference"
      [id]="differenceId"
      data-testid="field-difference"
    >
      <span class="field-difference__text">{{
        'contact.difference.inProfile' | transloco: { value: value }
      }}</span>
      <button
        class="btn btn--secondary field-difference__use"
        type="button"
        [attr.aria-label]="
          'contact.difference.useLabel' | transloco: { value: value }
        "
        (click)="use.emit()"
      >
        {{ 'contact.difference.use' | transloco }}
      </button>
    </p>
  `,
  styleUrl: './field-difference.component.scss',
})
export class FieldDifferenceComponent {
  /** The profile's value as shown (a gym's name, not its id). */
  @Input({ required: true }) value = '';
  /** Id of the note, for the field's aria-describedby. */
  @Input({ required: true }) differenceId = '';
  @Output() readonly use = new EventEmitter<void>();
}
