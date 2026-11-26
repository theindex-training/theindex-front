import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HolidayService } from '../../holidays/holiday.service';

/**
 * The official red logo. It works on the nav shell and on page backgrounds in both themes. Over
 * Christmas it wears a Santa hat (HolidayService).
 */
@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './brand.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './brand.component.scss',
})
export class BrandComponent {
  readonly holidays = inject(HolidayService);
}
