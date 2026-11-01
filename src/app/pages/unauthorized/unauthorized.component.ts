import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BrandComponent } from '../../components/brand/brand.component';
import { AuthService } from '../../services/auth.service';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [TranslocoPipe, BrandComponent],
  templateUrl: './unauthorized.component.html'
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
