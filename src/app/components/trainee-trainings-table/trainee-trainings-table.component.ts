import { Component, Input, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { ChipComponent } from '../chip/chip.component';
import { SkeletonListComponent } from '../skeleton-list/skeleton-list.component';
import { AttendanceTraineeTrainingItem } from '../../services/attendance.service';
import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainee-trainings-table',
  standalone: true,
  imports: [TranslocoPipe, EnumLabelPipe, UiMessagePipe, ChipComponent, SkeletonListComponent],
  templateUrl: './trainee-trainings-table.component.html'
})
export class TraineeTrainingsTableComponent {
  readonly format = inject(LocaleFormatService);

  @Input() trainings: AttendanceTraineeTrainingItem[] = [];
  @Input() loading = false;
  @Input() errorMessage: UiMessage | null = null;
  /** Translation key of the message shown when there are no trainings. */
  @Input() emptyKey = 'trainings.empty';

  formatTrainingTrainer(training: AttendanceTraineeTrainingItem): string {
    return displayValue(training.trainer.nickname || training.trainer.name);
  }

  formatTrainingLocation(training: AttendanceTraineeTrainingItem): string {
    return displayValue(training.location.name);
  }
}
