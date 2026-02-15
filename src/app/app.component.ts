import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '@environments/environment';
import { ApiService } from './services/api.service';
import { UiTranslationService } from './services/ui-translation.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true
})
export class AppComponent implements OnInit {

  constructor(
    private apiService: ApiService,
    private uiTranslationService: UiTranslationService
  ) {
    console.log(environment.production);
  }

  ngOnInit(): void {
    this.apiService.health().subscribe({
      next: (r) => console.log(r)
    });
  }
}
