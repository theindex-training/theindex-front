import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  route: string;
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

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/home' },
    { label: 'Plans', route: '/plans' },
    { label: 'Gyms', route: '/gyms' },
    { label: 'Trainers', route: '/trainers' },
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

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  handleLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
