import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exercise } from '../../services/exercises.service';
import { ChipComponent } from '../chip/chip.component';
import { IconComponent } from '../icon/icon.component';
import { ListRowComponent } from '../list-row/list-row.component';
import { StatusDotComponent } from '../status-dot/status-dot.component';

/**
 * The exercise catalogue as a list page shows it: a table from 768px, a list of rows below. Used
 * by the staff's Exercises page (with the status) and the trainees' exercise library (without:
 * they only get the active ones). Presentational: the page loads and filters `exercises`.
 */
@Component({
  selector: 'app-exercises-table',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    ChipComponent,
    IconComponent,
    ListRowComponent,
    StatusDotComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './exercises-table.component.html',
  // The table and the list stay direct children of the page's stack.
  styles: ':host { display: contents; }',
})
export class ExercisesTableComponent {
  @Input({ required: true }) exercises: Exercise[] = [];
  /** Where a row leads, e.g. the exercise's edit page. */
  @Input({ required: true }) link!: (exercise: Exercise) => string[];
  /** The table's caption and the list's name (translated). */
  @Input({ required: true }) label = '';
  /** The hidden name of the chevron column (translated), e.g. "Edit". */
  @Input({ required: true }) linkLabel = '';
  /** The Status column, and the dimmed rows with an Inactive chip on phones. */
  @Input() showStatus = false;
}
