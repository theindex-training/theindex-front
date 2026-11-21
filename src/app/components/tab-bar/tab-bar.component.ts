import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../icon/icon.component';
import { NavItem, isItemActive } from '../navigation/navigation';

/** Mobile (< 1024px) bottom tab bar. The last tab opens the navigation sheet. */
@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, IconComponent],
  templateUrl: './tab-bar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tab-bar.component.scss',
})
export class TabBarComponent {
  @Input({ required: true }) tabs: NavItem[] = [];
  /** Translation key of the sheet tab's label. */
  @Input({ required: true }) sheetLabel = 'nav.more';
  /** The current page lives in the sheet, so its tab shows as active. */
  @Input() sheetActive = false;
  @Input() sheetOpen = false;
  /** The current URL, for the active tab. */
  @Input() url = '';
  @Output() readonly openSheet = new EventEmitter<HTMLElement>();

  isActive(tab: NavItem): boolean {
    return isItemActive(this.url, tab);
  }
}
