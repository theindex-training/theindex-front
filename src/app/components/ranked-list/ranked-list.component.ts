import { Component, Input } from '@angular/core';

export interface RankedItem {
  label: string;
  value: number;
}

/** Card with a top-N list: rank, label, count and a bar proportional to the largest count. */
@Component({
  selector: 'app-ranked-list',
  standalone: true,
  templateUrl: './ranked-list.component.html',
  styleUrl: './ranked-list.component.scss'
})
export class RankedListComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input({ required: true }) items: RankedItem[] = [];
  /** Unit after each count, e.g. "trainings". */
  @Input() unit = '';
  @Input() emptyMessage = 'No data available.';

  barWidth(value: number): number {
    const max = Math.max(...this.items.map(item => item.value), 1);
    return Math.round((value / max) * 100);
  }
}
