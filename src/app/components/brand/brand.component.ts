import {
  Component,
  ChangeDetectionStrategy,
  Input,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HolidayService } from '../../holidays/holiday.service';
import { SurvachkaComponent } from '../../holidays/survachka.component';

/**
 * The official red logo. It works on the nav shell and on page backgrounds in both themes. Over
 * Christmas it wears a Santa hat, at New Year it sparkles, and from Jan 1 to Jan 6 a сурвачка
 * stands by it in the navigation shell (`inShell`), opening its New Year wish (HolidayService).
 */
@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, SurvachkaComponent],
  templateUrl: './brand.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './brand.component.scss',
})
export class BrandComponent {
  readonly holidays = inject(HolidayService);
  /** In the navigation shell, where the сурвачка's wish can open (`app-survachka-dialog`). */
  @Input() inShell = false;
  readonly sparkles = [1, 2];
}
