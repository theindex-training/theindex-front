import { Component, Input } from '@angular/core';

export type IconName =
  | 'home'
  | 'users'
  | 'check'
  | 'history'
  | 'wallet'
  | 'banknote'
  | 'clipboard'
  | 'dumbbell'
  | 'ticket'
  | 'trainer'
  | 'clock'
  | 'user'
  | 'chart'
  | 'trophy'
  | 'more'
  | 'settings'
  | 'key'
  | 'log-out'
  | 'close'
  | 'search'
  | 'chevron-right'
  | 'plus'
  | 'alert'
  | 'trash';

/**
 * Inline stroke icons in the Lucide style (24px grid, 2px round strokes, currentColor).
 * Decorative by default: always pair with a visible or aria label on the parent control.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss'
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
}
