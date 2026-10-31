import { Component, Input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BrandComponent } from '../brand/brand.component';
import { LanguageSwitchComponent } from '../language-switch/language-switch.component';
import { NavItem } from '../navigation/navigation';
import { ThemeSwitchComponent } from '../theme-switch/theme-switch.component';
import { UserBlockComponent } from '../user-block/user-block.component';

/** Desktop (≥ 1024px) navigation: brand, main items, "Manage" group, theme and language switches, user block. */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    BrandComponent,
    LanguageSwitchComponent,
    ThemeSwitchComponent,
    UserBlockComponent
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input({ required: true }) mainItems: NavItem[] = [];
  @Input() manageItems: NavItem[] = [];
}
