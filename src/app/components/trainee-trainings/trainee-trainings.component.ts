import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UiMessage } from '../../i18n/ui-message';
import { AttendanceTraineeTrainingItem } from '../../services/attendance.service';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../segmented-control/segmented-control.component';
import { TraineeTrainingsTableComponent } from '../trainee-trainings-table/trainee-trainings-table.component';
import { TrainingsCalendarComponent } from '../trainings-calendar/trainings-calendar.component';
import { TranslocoPipe } from '@jsverse/transloco';

export type TrainingsView = 'calendar' | 'list';

/** localStorage key of the last chosen view; shared by every page that shows a trainee's trainings. */
export const TRAININGS_VIEW_STORAGE_KEY = 'trainingsView';

/**
 * A trainee's trainings section: heading, a Calendar / List switch and the chosen view. Calendar is
 * the default; an explicit choice is remembered on this device.
 */
@Component({
  selector: 'app-trainee-trainings',
  standalone: true,
  imports: [
    TranslocoPipe,
    SegmentedControlComponent,
    TraineeTrainingsTableComponent,
    TrainingsCalendarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './trainee-trainings.component.html',
  host: { class: 'page-stack' },
})
export class TraineeTrainingsComponent {
  /** Section heading and the line under it, already translated. */
  @Input({ required: true }) heading = '';
  @Input() subheading = '';
  /** Id of the heading, so the page can label its section with it. */
  @Input({ required: true }) headingId = '';
  @Input() trainings: AttendanceTraineeTrainingItem[] = [];
  @Input() loading = false;
  @Input() errorMessage: UiMessage | null = null;
  /** Translation key of the message shown when there are no trainings. */
  @Input() emptyKey = 'trainings.empty';

  readonly viewOptions: SegmentedOption<TrainingsView>[] = [
    { value: 'calendar', label: 'trainings.view.calendar' },
    { value: 'list', label: 'trainings.view.list' },
  ];

  view: TrainingsView = readStoredView();

  setView(view: TrainingsView): void {
    this.view = view;
    try {
      localStorage.setItem(TRAININGS_VIEW_STORAGE_KEY, view);
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the choice then lasts until reload.
    }
  }
}

function readStoredView(): TrainingsView {
  try {
    return localStorage.getItem(TRAININGS_VIEW_STORAGE_KEY) === 'list'
      ? 'list'
      : 'calendar';
  } catch {
    return 'calendar';
  }
}
