import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { IconComponent } from '../icon/icon.component';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PageItem,
  clampPage,
  pageCount,
  pageItems,
} from './pagination';

let nextId = 0;

/**
 * Page controls under a long list: First, Previous, the numbered pages (with gaps), Next and Last,
 * plus how many rows a page shows. Presentational: the page keeps `page` and `pageSize`, loads or
 * cuts the rows, and reacts to `pageChange` / `pageSizeChange`. Works the same for rows the API
 * pages (`offset`/`limit`) and for a list the browser already has (`pageSlice`).
 *
 * Phones show "3 / 97" (read as "Page 3 of 97") between the arrows instead of the numbers. Nothing shows while the
 * whole list fits on the smallest page size.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [TranslocoPipe, IconComponent],
  templateUrl: './pagination.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  readonly format = inject(LocaleFormatService);

  /** Accessible name of the navigation (already translated), e.g. "Paid trainings pages". */
  @Input({ required: true }) label = '';
  /** How many rows the whole list has. */
  @Input({ required: true }) total = 0;
  /** The page shown, from 1. */
  @Input() page = 1;
  @Input() pageSize = DEFAULT_PAGE_SIZE;
  @Input() pageSizeOptions: readonly number[] = PAGE_SIZE_OPTIONS;
  @Output() readonly pageChange = new EventEmitter<number>();
  /** A new page size; the page then goes back to page 1. */
  @Output() readonly pageSizeChange = new EventEmitter<number>();

  readonly sizeId = `page-size-${nextId++}`;

  get shown(): boolean {
    return this.total > Math.min(...this.pageSizeOptions);
  }

  get count(): number {
    return pageCount(this.total, this.pageSize);
  }

  get current(): number {
    return clampPage(this.page, this.total, this.pageSize);
  }

  get items(): PageItem[] {
    return pageItems(this.current, this.count);
  }

  go(page: number): void {
    const target = clampPage(page, this.total, this.pageSize);
    if (target !== this.current) {
      this.pageChange.emit(target);
    }
  }

  changeSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (size !== this.pageSize && this.pageSizeOptions.includes(size)) {
      this.pageSizeChange.emit(size);
    }
  }
}
