import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  templateUrl: './unauthorized.component.html',
  styleUrl: './unauthorized.component.scss'
})
export class UnauthorizedComponent {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  handleLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
