import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UiButtonComponent } from '../../components/ui-button/ui-button.component';
import { UiCheckboxComponent } from '../../components/ui-checkbox/ui-checkbox.component';
import { UiInputComponent } from '../../components/ui-input/ui-input.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true,
  imports: [UiButtonComponent, UiCheckboxComponent, UiInputComponent]
})
export class LoginComponent {
  constructor(private readonly router: Router) {}

  handleLogin(): void {
    this.router.navigate(['/home']);
  }
}
