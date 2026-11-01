import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** The official red logo. It works on the nav shell and on page backgrounds in both themes. */
@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './brand.component.html',
  styleUrl: './brand.component.scss'
})
export class BrandComponent {}
