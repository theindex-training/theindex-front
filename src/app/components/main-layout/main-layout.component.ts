import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  route?: string;
  children?: NavItem[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  isMenuOpen = false;
  isManageMenuOpen = false;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/home' },
    {
      label: 'Manage',
      children: [
        { label: 'Plans', route: '/plans' },
        { label: 'Gyms', route: '/gyms' },
        { label: 'Gym subscriptions', route: '/gym-subscriptions' },
        { label: 'Trainers', route: '/trainers' },
        { label: 'Training times', route: '/training-times' }
      ]
    },
    { label: 'Trainees', route: '/trainees' },
    { label: 'Attendance', route: '/attendance' },
    { label: 'Settlements', route: '/settlements' }
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
