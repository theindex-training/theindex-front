import { TestBed } from '@angular/core/testing';
import { AttendanceTraineeTrainingItem } from '../../services/attendance.service';
import { TraineeTrainingsTableComponent } from './trainee-trainings-table.component';

function training(
  overrides: Partial<AttendanceTraineeTrainingItem> = {},
): AttendanceTraineeTrainingItem {
  return {
    id: 'a1',
    traineeId: 't1',
    trainerId: 'tr1',
    trainer: { id: 'tr1', name: 'Petar Ivanov', nickname: 'Pepi' },
    locationId: 'g1',
    location: { id: 'g1', name: 'Center' },
    trainedAt: '2026-11-01T16:30:00Z',
    subscriptionId: null,
    gymSubscriptionId: null,
    paymentStatus: 'PAID',
    createdAt: '2026-11-01T16:30:00Z',
    ...overrides,
  };
}

describe('TraineeTrainingsTableComponent', () => {
  const component = () =>
    TestBed.createComponent(TraineeTrainingsTableComponent).componentInstance;

  it('names the trainer by nickname, then name, then a dash', () => {
    const table = component();

    expect(table.formatTrainingTrainer(training())).toBe('Pepi');
    expect(
      table.formatTrainingTrainer(
        training({ trainer: { id: 'tr1', name: 'Petar', nickname: null } }),
      ),
    ).toBe('Petar');
    expect(
      table.formatTrainingTrainer(
        training({ trainer: { id: 'tr1', name: ' ', nickname: '' } }),
      ),
    ).toBe('—');
  });

  it('names the gym, or shows a dash', () => {
    const table = component();

    expect(table.formatTrainingLocation(training())).toBe('Center');
    expect(
      table.formatTrainingLocation(
        training({ location: { id: 'g1', name: '' } }),
      ),
    ).toBe('—');
  });

  it('renders the rows with trainer and gym', async () => {
    const fixture = TestBed.createComponent(TraineeTrainingsTableComponent);
    fixture.componentRef.setInput('trainings', [training()]);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Pepi');
    expect(fixture.nativeElement.textContent).toContain('Center');
  });
});
