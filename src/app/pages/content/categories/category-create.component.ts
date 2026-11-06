import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import { ArticleCategoriesService } from '../../../services/article-categories.service';
import { CategoryFieldsComponent } from './category-fields.component';
import {
  buildCategoryForm,
  CategoryForm,
  createCategoryPayload,
} from './category-form';

@Component({
  selector: 'app-category-create',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    CategoryFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './category-create.component.html',
})
export class CategoryCreateComponent {
  readonly form: CategoryForm;

  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly categoriesService: ArticleCategoriesService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.form = buildCategoryForm(formBuilder, 'create');
  }

  handleSubmit(): void {
    if (this.submitting) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    this.categoriesService.create(createCategoryPayload(this.form)).subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigate(['/content/categories']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'content.categories.create.error',
        );
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
