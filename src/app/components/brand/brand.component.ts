import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** "TI" mark + wordmark. Text color is inherited, so it works on the nav shell and on page backgrounds. */
@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './brand.component.html',
  styleUrl: './brand.component.scss'
})
export class BrandComponent {}
