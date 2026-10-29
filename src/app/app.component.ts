import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '@environments/environment';
import { ApiService } from './services/api.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true
})
export class AppComponent implements OnInit {

  // ThemeService is injected here so it tracks OS theme changes on every route, including login.
  constructor(
    private apiService: ApiService,
    private themeService: ThemeService
  ) {
    console.log(environment.production);
  }

  ngOnInit(): void {
    this.apiService.health().subscribe({
      next: (r) => console.log(r)
    });
  }
}
