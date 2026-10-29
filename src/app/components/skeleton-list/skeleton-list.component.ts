import { Component, Input } from '@angular/core';

/** Loading placeholder shaped like list rows (avatar, two lines, chip). Announces `label` to screen readers. */
@Component({
  selector: 'app-skeleton-list',
  standalone: true,
  templateUrl: './skeleton-list.component.html',
  styleUrl: './skeleton-list.component.scss'
})
export class SkeletonListComponent {
  @Input() rows = 6;
  @Input() label = 'Loading';

  get rowIndexes(): number[] {
    return Array.from({ length: this.rows }, (_, index) => index);
  }
}
