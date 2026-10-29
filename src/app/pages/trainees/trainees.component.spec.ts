import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TraineeProfile } from '../../services/trainees.service';
import { TraineesComponent } from './trainees.component';

const trainee = (overrides: Partial<TraineeProfile> = {}): TraineeProfile => ({
  id: 't1',
  name: 'Georgi Ivanov',
  nickname: 'Gosho',
  phone: '+359 888 214 503',
  accountId: null,
  gymSubscriptionId: null,
  isActive: true,
  ...overrides
});

describe('TraineesComponent display helpers', () => {
  let component: TraineesComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    component = TestBed.createComponent(TraineesComponent).componentInstance;
    component.gymSubscriptions = [{ id: 'gs1', name: 'Multisport', isActive: true }];
  });

  it('formats nicknames in quotes, with a fallback', () => {
    expect(component.nicknameLabel(trainee())).toBe('“Gosho”');
    expect(component.nicknameLabel(trainee({ nickname: '  ' }))).toBe('No nickname');
  });

  it('resolves the gym card name, or null when missing/unknown', () => {
    expect(component.gymCardName(trainee({ gymSubscriptionId: 'gs1' }))).toBe('Multisport');
    expect(component.gymCardName(trainee({ gymSubscriptionId: 'unknown' }))).toBeNull();
    expect(component.gymCardName(trainee())).toBeNull();
  });

  it('shows "Inactive" before the gym card on mobile rows', () => {
    expect(component.trailingChip(trainee({ isActive: false, gymSubscriptionId: 'gs1' }))).toEqual({
      label: 'Inactive',
      tone: 'neutral'
    });
    expect(component.trailingChip(trainee({ gymSubscriptionId: 'gs1' }))).toEqual({
      label: 'Multisport',
      tone: 'accent'
    });
    expect(component.trailingChip(trainee())).toBeNull();
  });
});
