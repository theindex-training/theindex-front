import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { CategoryForm, CategoryFormMode } from './category-form';

/** The fields shared by the create and edit pages; the page owns the form and its submit. */
@Component({
  selector: 'app-category-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './category-fields.component.html',
})
export class CategoryFieldsComponent {
  @Input({ required: true }) form!: CategoryForm;
  @Input() mode: CategoryFormMode = 'create';

  /** Whether to show the control's error instead of its hint. */
  showError(name: keyof CategoryForm['controls']): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }
}
