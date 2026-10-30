import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The official red logo. It works on the nav shell and on page backgrounds in both themes. */
@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './brand.component.html',
  styleUrl: './brand.component.scss'
})
export class BrandComponent {}
