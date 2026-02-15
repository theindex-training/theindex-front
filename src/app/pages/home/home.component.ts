import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
})
export class HomeComponent {
  readonly userRole: string | null;

  constructor(private readonly authService: AuthService) {
    this.userRole = this.authService.getUserRole();
  }

  get canSeeQuickLinks(): boolean {
    return this.userRole === 'ADMIN' || this.userRole === 'TRAINER';
  }
}
