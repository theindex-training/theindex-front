import { Component, Input } from '@angular/core';

/** Colored dot + text label (the label carries the meaning; the dot is decorative). */
@Component({
  selector: 'app-status-dot',
  standalone: true,
  templateUrl: './status-dot.component.html',
  styleUrl: './status-dot.component.scss'
})
export class StatusDotComponent {
  @Input() tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
}
