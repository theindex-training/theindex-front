import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../icon/icon.component';
import { NavItem } from '../navigation/navigation';

/** Mobile (< 1024px) bottom tab bar. The last tab opens the navigation sheet. */
@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, IconComponent],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.scss'
})
export class TabBarComponent {
  @Input({ required: true }) tabs: NavItem[] = [];
  /** Translation key of the sheet tab's label. */
  @Input({ required: true }) sheetLabel = 'nav.more';
  /** The current page lives in the sheet, so its tab shows as active. */
  @Input() sheetActive = false;
  @Input() sheetOpen = false;
  @Output() readonly openSheet = new EventEmitter<HTMLElement>();
}
