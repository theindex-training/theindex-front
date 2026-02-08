import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true
})
export class HomeComponent {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  handleLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
