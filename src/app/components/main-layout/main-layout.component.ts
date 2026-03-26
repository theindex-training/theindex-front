import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  route?: string;
  children?: NavItem[];
  roles?: string[];
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
  readonly isTrainee: boolean;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/home' },
    {
      label: 'Manage',
      children: [
        { label: 'Plans', route: '/plans' },
        { label: 'Gyms', route: '/gyms' },
        { label: 'Gym subscriptions', route: '/gym-subscriptions' },
        { label: 'Trainers', route: '/trainers', roles: ['ADMIN'] },
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
    { label: 'Settlements', route: '/settlements' },
    { label: 'Cash register', route: '/cash-register', roles: ['ADMIN'] }
  ];

  readonly traineeNavItems: NavItem[] = [
    { label: 'Profile', route: '/my-profile' },
    { label: 'Records', route: '/records' }
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.userEmail = this.authService.getUserEmail() ?? 'User';
    this.isTrainee = this.authService.getUserRole() === 'TRAINEE';
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

  isParentActive(item: NavItem): boolean {
    return !!item.children?.some(
      child => this.canViewNavItem(child) && child.route && this.router.url.startsWith(child.route)
    );
  }

  get visibleNavItems(): NavItem[] {
    return this.isTrainee ? this.traineeNavItems : this.navItems;
  }

  canViewNavItem(item: NavItem): boolean {
    if (!item.roles?.length) {
      return true;
    }

    const userRole = this.authService.getUserRole();
    return !!userRole && item.roles.includes(userRole);
  }

  handleLogout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
