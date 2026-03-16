import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AttendanceTraineeTrainingItem } from '../../services/attendance.service';
import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainee-trainings-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trainee-trainings-table.component.html',
  styleUrl: './trainee-trainings-table.component.scss',
})
export class TraineeTrainingsTableComponent {
  @Input() trainings: AttendanceTraineeTrainingItem[] = [];
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() emptyMessage = 'No trainings yet.';

  formatTrainingDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatTrainingTrainer(training: AttendanceTraineeTrainingItem): string {
    return displayValue(training.trainer.nickname || training.trainer.name);
  }

  formatTrainingLocation(training: AttendanceTraineeTrainingItem): string {
    return displayValue(training.location.name);
  }

  statusClass(training: AttendanceTraineeTrainingItem): string {
    return training.paymentStatus === 'PAID' ? 'status-paid' : 'status-unpaid';
  }
}
