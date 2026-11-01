import { Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Loading placeholder shaped like list rows (avatar, two lines, chip). Announces `label` to screen readers. */
@Component({
  selector: 'app-skeleton-list',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './skeleton-list.component.html',
  styleUrl: './skeleton-list.component.scss'
})
export class SkeletonListComponent {
  @Input() rows = 6;
  /** Already translated; defaults to "Loading". */
  @Input() label = '';

  get rowIndexes(): number[] {
    return Array.from({ length: this.rows }, (_, index) => index);
  }
}
