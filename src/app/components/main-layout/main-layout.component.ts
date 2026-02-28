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
  openSubmenuLabel: string | null = null;
  isUserMenuOpen = false;
  readonly userEmail: string;

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
    {
      label: 'Attendance',
      children: [
        { label: 'Register', route: '/attendance/new' },
        { label: 'List attendance', route: '/attendance' }
      ]
    },
    { label: 'Settlements', route: '/settlements' }
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.userEmail = this.authService.getUserEmail() ?? 'User';
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  toggleSubmenu(item: NavItem): void {
    this.openSubmenuLabel = this.openSubmenuLabel === item.label ? null : item.label;
  }

  isSubmenuOpen(item: NavItem): boolean {
    return this.openSubmenuLabel === item.label;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    this.openSubmenuLabel = null;
    this.isUserMenuOpen = false;
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  setLanguage(_language: 'en' | 'bg'): void {
    this.isUserMenuOpen = false;
  }

  toggleDarkMode(): void {
    this.isUserMenuOpen = false;
  }

  isParentActive(item: NavItem): boolean {
    return !!item.children?.some(
      child => this.canViewNavItem(child) && child.route && this.router.url.startsWith(child.route)
    );
  }

  canViewNavItem(item: NavItem): boolean {
    if (item.route === '/trainers') {
      return this.authService.getUserRole() === 'ADMIN';
    }

    return true;
  }

  handleLogout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
