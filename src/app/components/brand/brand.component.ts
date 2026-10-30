import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The logo badge. Uses the fixed --brand-* colors, so it looks the same on the nav shell, on page backgrounds and in both themes. */
@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './brand.component.html',
  styleUrl: './brand.component.scss'
})
export class BrandComponent {}
