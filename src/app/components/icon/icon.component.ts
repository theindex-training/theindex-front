import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

export type IconName =
  | 'home'
  | 'play'
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
  | 'user-plus'
  | 'chart'
  | 'trophy'
  | 'more'
  | 'settings'
  | 'key'
  | 'log-out'
  | 'close'
  | 'search'
  | 'chevron-left'
  | 'chevron-right'
  | 'plus'
  | 'alert'
  | 'trash'
  | 'arrow-left'
  | 'eye'
  | 'eye-off'
  | 'file-text'
  | 'renew'
  | 'chevron-up'
  | 'chevron-down'
  | 'timer'
  | 'pencil'
  | 'calendar';

/**
 * Inline stroke icons in the Lucide style (24px grid, 2px round strokes, currentColor).
 * Decorative by default: always pair with a visible or aria label on the parent control.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
}
