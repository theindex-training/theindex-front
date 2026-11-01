import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeMode, ThemeService } from '../../services/theme.service';

let nextId = 0;

/** Light / Dark / Auto segmented control for the navigation shell. Native radios give arrow-key support. */
@Component({
  selector: 'app-theme-switch',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './theme-switch.component.html',
  styleUrl: './theme-switch.component.scss'
})
export class ThemeSwitchComponent {
  readonly themeService = inject(ThemeService);
  // Sidebar and sheet both render a switch, so each radio group needs its own name.
  readonly name = `theme-switch-${nextId++}`;

  readonly options: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'common.theme.light' },
    { value: 'dark', label: 'common.theme.dark' },
    { value: 'system', label: 'common.theme.system' }
  ];
}
