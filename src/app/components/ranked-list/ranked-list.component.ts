import { Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export interface RankedItem {
  label: string;
  value: number;
}

/** Card with a top-N list: rank, label, count and a bar proportional to the largest count. */
@Component({
  selector: 'app-ranked-list',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './ranked-list.component.html',
  styleUrl: './ranked-list.component.scss'
})
export class RankedListComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input({ required: true }) items: RankedItem[] = [];
  /**
   * ICU plural key for each count, called with `{ count }`, e.g. 'stats.trainings' →
   * "{count, plural, one {# training} other {# trainings}}". Omit to show the bare number.
   */
  @Input() countKey = '';
  /** Already translated; defaults to "No data available." */
  @Input() emptyMessage = '';

  barWidth(value: number): number {
    const max = Math.max(...this.items.map(item => item.value), 1);
    return Math.round((value / max) * 100);
  }
}
