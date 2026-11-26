import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HolidayLightsComponent } from '../../holidays/holiday-lights.component';
import { HolidaySwitchComponent } from '../../holidays/holiday-switch.component';
import { BrandComponent } from '../brand/brand.component';
import { LanguageSwitchComponent } from '../language-switch/language-switch.component';
import { NavGroup, NavItem, isItemActive } from '../navigation/navigation';
import { ThemeSwitchComponent } from '../theme-switch/theme-switch.component';
import { UserBlockComponent } from '../user-block/user-block.component';

/** Desktop (≥ 1024px) navigation: brand, the grouped items, theme and language switches, user block. */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    BrandComponent,
    HolidayLightsComponent,
    HolidaySwitchComponent,
    LanguageSwitchComponent,
    ThemeSwitchComponent,
    UserBlockComponent,
  ],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input({ required: true }) groups: NavGroup[] = [];
  /** The current URL, for the active item. */
  @Input() url = '';

  isActive(item: NavItem): boolean {
    return isItemActive(this.url, item);
  }
}
