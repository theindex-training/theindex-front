import { Component, Input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

/**
 * Centered message for empty lists and load errors. Put buttons/links in the default slot.
 * `tone="danger"` uses the alert icon and role="alert" so the error is announced.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss'
})
export class EmptyStateComponent {
  @Input({ required: true }) title = '';
  @Input() message = '';
  @Input() icon: IconName = 'search';
  @Input() tone: 'neutral' | 'danger' = 'neutral';
}
