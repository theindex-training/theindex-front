import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { GymLocation, GymLocationsService } from '../../services/gym-locations.service';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';
import { TrainingTime, TrainingTimesService } from '../../services/training-times.service';
import { formatTimeWithoutSeconds } from '../../utils/time-display';

@Component({
  selector: 'app-attendance-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './attendance-register.component.html',
  styleUrl: './attendance-register.component.scss'
})
export class AttendanceRegisterComponent implements OnInit {
  readonly form: FormGroup<{
    trainerId: FormControl<string>;
    locationId: FormControl<string>;
    trainedDate: FormControl<string>;
    trainedTime: FormControl<string>;
    traineeSearch: FormControl<string>;
  }>;

  loading = true;
  submitting = false;
  errorMessage = '';

  trainers: TrainerProfile[] = [];
  gymLocations: GymLocation[] = [];
  trainingTimes: TrainingTime[] = [];
  trainees: TraineeProfile[] = [];
  filteredTrainees: TraineeProfile[] = [];
  selectedTraineeIds = new Set<string>();

  readonly formatTimeWithoutSeconds = formatTimeWithoutSeconds;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainersService: TrainersService,
    private readonly gymsService: GymLocationsService,
    private readonly trainingTimesService: TrainingTimesService,
    private readonly traineesService: TraineesService,
    private readonly attendanceService: AttendanceService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.form = this.formBuilder.group({
      trainerId: this.formBuilder.nonNullable.control('', [Validators.required]),
      locationId: this.formBuilder.nonNullable.control('', [Validators.required]),
      trainedDate: this.formBuilder.nonNullable.control(this.todayIsoDate(), [Validators.required]),
      trainedTime: this.formBuilder.nonNullable.control(''),
      traineeSearch: this.formBuilder.nonNullable.control('')
    });
  }

  ngOnInit(): void {
    forkJoin({
      trainers: this.trainersService.list(true),
      gymLocations: this.gymsService.list(false),
      trainingTimes: this.trainingTimesService.list(),
      trainees: this.traineesService.list(true)
    }).subscribe({
      next: ({ trainers, gymLocations, trainingTimes, trainees }) => {
        this.trainers = trainers.filter(item => item.isActive);
        this.gymLocations = gymLocations.filter(item => item.isActive);
        this.trainingTimes = [...trainingTimes].sort(
          (first, second) => this.toMinutes(first.startTime) - this.toMinutes(second.startTime)
        );
        this.trainees = trainees.filter(item => item.isActive);
        this.filteredTrainees = [...this.trainees];
        this.preselectCurrentTrainer();
        this.preselectDefaultLocation();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message ||
          'Unable to load trainers, gyms, training times, or trainees right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });

    this.form.controls.traineeSearch.valueChanges.subscribe(value => {
      this.applyTraineeFilter(value);
      this.changeDetector.detectChanges();
    });
  }

  handleSubmit(): void {
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.changeDetector.detectChanges();
      return;
    }

    if (this.selectedTraineeIds.size === 0) {
      this.errorMessage = 'Select at least one trainee for this attendance batch.';
      this.changeDetector.detectChanges();
      return;
    }

    const raw = this.form.getRawValue();
    const trainedTime = formatTimeWithoutSeconds(raw.trainedTime.trim());

    this.submitting = true;

    this.attendanceService
      .createBatch({
        trainerId: raw.trainerId,
        locationId: raw.locationId,
        traineeIds: Array.from(this.selectedTraineeIds),
        trainedDate: raw.trainedDate,
        ...(trainedTime ? { trainedTime } : {})
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.changeDetector.detectChanges();
          this.router.navigate(['/attendance']);
        },
        error: (error) => {
          this.errorMessage = error?.error?.message || 'Unable to register attendance right now.';
          this.submitting = false;
          this.changeDetector.detectChanges();
        }
      });
  }

  isSelected(traineeId: string): boolean {
    return this.selectedTraineeIds.has(traineeId);
  }

  toggleTraineeSelection(traineeId: string, checked: boolean): void {
    if (checked) {
      this.selectedTraineeIds.add(traineeId);
    } else {
      this.selectedTraineeIds.delete(traineeId);
    }

    this.changeDetector.detectChanges();
  }

  selectFiltered(): void {
    this.filteredTrainees.forEach(trainee => this.selectedTraineeIds.add(trainee.id));
    this.changeDetector.detectChanges();
  }

  clearFiltered(): void {
    this.filteredTrainees.forEach(trainee => this.selectedTraineeIds.delete(trainee.id));
    this.changeDetector.detectChanges();
  }

  formatTrainingTimeOption(trainingTime: TrainingTime): string {
    return `${formatTimeWithoutSeconds(trainingTime.startTime)} - ${formatTimeWithoutSeconds(trainingTime.endTime)}`;
  }

  private preselectDefaultLocation(): void {
    const firstLocation = this.gymLocations[0];
    if (firstLocation) {
      this.form.controls.locationId.setValue(firstLocation.id);
    }
  }

  private preselectCurrentTrainer(): void {
    const currentTrainerId = this.authService.getTrainerProfileId();

    if (currentTrainerId && this.trainers.some(item => item.id === currentTrainerId)) {
      this.form.controls.trainerId.setValue(currentTrainerId);
      return;
    }

    const firstTrainer = this.trainers[0];
    if (firstTrainer) {
      this.form.controls.trainerId.setValue(firstTrainer.id);
    }
  }

  private applyTraineeFilter(searchValue: string): void {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      this.filteredTrainees = [...this.trainees];
      return;
    }

    this.filteredTrainees = this.trainees.filter(trainee => {
      const nameMatch = trainee.name.toLowerCase().includes(normalizedSearch);
      const nicknameMatch = (trainee.nickname || '').toLowerCase().includes(normalizedSearch);
      return nameMatch || nicknameMatch;
    });
  }

  private toMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return hours * 60 + minutes;
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
