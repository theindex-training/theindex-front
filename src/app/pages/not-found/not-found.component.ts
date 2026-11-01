import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandComponent } from '../../components/brand/brand.component';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  imports: [TranslocoPipe, RouterLink, BrandComponent],
  templateUrl: './not-found.component.html',
  standalone: true
})
export class NotFoundComponent {
}
