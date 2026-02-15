import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  labelKey: string;
  route?: string;
  children?: NavItem[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  isMenuOpen = false;
  isManageMenuOpen = false;

  readonly navItems: NavItem[] = [
    { labelKey: 'nav.dashboard', route: '/home' },
    {
      labelKey: 'nav.manage',
      children: [
        { labelKey: 'nav.plans', route: '/plans' },
        { labelKey: 'nav.gyms', route: '/gyms' },
        { labelKey: 'nav.gymSubscriptions', route: '/gym-subscriptions' },
        { labelKey: 'nav.trainers', route: '/trainers' },
        { labelKey: 'nav.trainingTimes', route: '/training-times' }
      ]
    },
    { labelKey: 'nav.trainees', route: '/trainees' },
    { labelKey: 'nav.attendance', route: '/attendance' },
    { labelKey: 'nav.settlements', route: '/settlements' }
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  toggleManageMenu(): void {
    this.isManageMenuOpen = !this.isManageMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    this.isManageMenuOpen = false;
  }

  isManageActive(item: NavItem): boolean {
    return !!item.children?.some(child => child.route && this.router.url.startsWith(child.route));
  }

  handleLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
