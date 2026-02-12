import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { GymLocation, GymLocationsService } from '../../services/gym-locations.service';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

@Component({
  selector: 'app-attendance-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
  successMessage = '';

  trainers: TrainerProfile[] = [];
  gymLocations: GymLocation[] = [];
  trainees: TraineeProfile[] = [];
  filteredTrainees: TraineeProfile[] = [];
  selectedTraineeIds = new Set<string>();

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainersService: TrainersService,
    private readonly gymsService: GymLocationsService,
    private readonly traineesService: TraineesService,
    private readonly attendanceService: AttendanceService,
    private readonly authService: AuthService
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
      trainees: this.traineesService.list(true)
    }).subscribe({
      next: ({ trainers, gymLocations, trainees }) => {
        this.trainers = trainers.filter(item => item.isActive);
        this.gymLocations = gymLocations.filter(item => item.isActive);
        this.trainees = trainees.filter(item => item.isActive);
        this.filteredTrainees = [...this.trainees];
        this.preselectCurrentTrainer();
        this.preselectDefaultLocation();
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load trainers, gyms, or trainees right now.';
        this.loading = false;
      }
    });

    this.form.controls.traineeSearch.valueChanges.subscribe(value => {
      this.applyTraineeFilter(value);
    });
  }

  handleSubmit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.selectedTraineeIds.size === 0) {
      this.errorMessage = 'Select at least one trainee for this attendance batch.';
      return;
    }

    const raw = this.form.getRawValue();
    const trainedTime = raw.trainedTime.trim();

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
        next: (response) => {
          this.submitting = false;
          this.successMessage = `Attendance registered for ${response.count} trainee(s).`;
          this.selectedTraineeIds.clear();
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message || 'Unable to register attendance right now.';
          this.submitting = false;
        }
      });
  }

  isSelected(traineeId: string): boolean {
    return this.selectedTraineeIds.has(traineeId);
  }

  toggleTraineeSelection(traineeId: string, checked: boolean): void {
    if (checked) {
      this.selectedTraineeIds.add(traineeId);
      return;
    }

    this.selectedTraineeIds.delete(traineeId);
  }

  selectFiltered(): void {
    this.filteredTrainees.forEach(trainee => this.selectedTraineeIds.add(trainee.id));
  }

  clearFiltered(): void {
    this.filteredTrainees.forEach(trainee => this.selectedTraineeIds.delete(trainee.id));
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

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
