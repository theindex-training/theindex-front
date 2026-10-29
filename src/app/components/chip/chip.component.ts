import { Component, Input } from '@angular/core';

export type ChipTone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger';

/** Small uppercase label, e.g. a gym card or a status. Content is the label text. */
@Component({
  selector: 'app-chip',
  standalone: true,
  templateUrl: './chip.component.html',
  styleUrl: './chip.component.scss'
})
export class ChipComponent {
  @Input() tone: ChipTone = 'neutral';
}
