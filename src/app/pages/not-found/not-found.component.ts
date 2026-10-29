import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandComponent } from '../../components/brand/brand.component';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, BrandComponent],
  templateUrl: './not-found.component.html',
  standalone: true
})
export class NotFoundComponent {
}
