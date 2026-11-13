import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  GymLocation,
  GymLocationsService,
} from '../../services/gym-locations.service';

/**
 * A profile's home gym (a trainee's preferred gym, a trainer's primary gym): an optional select
 * of the active gyms, plus the profile's own gym if it has become inactive. '' is none. It loads
 * the gyms itself; if that fails, it offers none and keeps the value.
 */
@Component({
  selector: 'app-home-gym-field',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="form-field">
      <label class="form-field__label" [for]="fieldId"
        >{{ label }}
        <span class="form-field__optional">{{
          'common.optional' | transloco
        }}</span></label
      >
      <select
        [id]="fieldId"
        [formControl]="control"
        [attr.aria-describedby]="fieldId + '-help'"
      >
        <option value="">{{ 'gyms.homeGym.none' | transloco }}</option>
        @for (gym of options; track gym.id) {
          <option [value]="gym.id">
            {{
              gym.isActive
                ? gym.name
                : ('gyms.homeGym.inactive' | transloco: { name: gym.name })
            }}
          </option>
        }
      </select>
      <span class="form-field__hint" [id]="fieldId + '-help'">{{ hint }}</span>
    </div>
  `,
})
export class HomeGymFieldComponent implements OnInit {
  @Input({ required: true }) control!: FormControl<string>;
  @Input({ required: true }) fieldId = '';
  /** Translated label, e.g. "Preferred gym". */
  @Input({ required: true }) label = '';
  /** Translated hint saying what the gym is used for. */
  @Input({ required: true }) hint = '';

  private gyms: GymLocation[] = [];

  constructor(
    private readonly gymsService: GymLocationsService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.gymsService.list(true).subscribe({
      next: (gyms) => {
        this.gyms = gyms;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.gyms = [];
      },
    });
  }

  get options(): GymLocation[] {
    return this.gyms.filter((g) => g.isActive || g.id === this.control.value);
  }
}
