import { Component, computed, inject } from '@angular/core';
import { ThemeMode, ThemeService } from '../../services/theme.service';

// Temporary home in the header; phase 2 of the redesign moves it into the new navigation.
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss'
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);

  readonly labels: Record<ThemeMode, string> = {
    light: 'Light',
    dark: 'Dark',
    system: 'Auto'
  };

  readonly label = computed(() => {
    const mode = this.themeService.mode();
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    const current = mode === 'system' ? 'Auto (follows your device)' : this.labels[mode];
    return `Theme: ${current}. Switch to ${this.labels[next]}.`;
  });
}
