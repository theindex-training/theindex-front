import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import {
  apiErrorMessage,
  i18nMessage,
  UiMessage,
} from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import {
  ArticleCategoriesService,
  ArticleCategory,
} from '../../../services/article-categories.service';
import { CategoryFieldsComponent } from './category-fields.component';
import {
  buildCategoryForm,
  CategoryForm,
  updateCategoryPayload,
} from './category-form';

@Component({
  selector: 'app-category-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    CategoryFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './category-edit.component.html',
})
export class CategoryEditComponent implements OnInit {
  readonly form: CategoryForm;

  category: ArticleCategory | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly categoriesService: ArticleCategoriesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.form = buildCategoryForm(formBuilder, 'edit');
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('content.categories.errors.missingId');
      this.loading = false;
      return;
    }

    this.categoriesService.getById(id).subscribe({
      next: (category) => {
        this.category = category;
        this.form.setValue({
          name: category.name,
          slug: category.slug,
          description: category.description ?? '',
          sortOrder: category.sortOrder,
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'content.categories.errors.load',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  handleSubmit(): void {
    if (!this.category || this.submitting) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    this.categoriesService
      .update(this.category.id, updateCategoryPayload(this.form))
      .subscribe({
        next: () => {
          this.submitting = false;
          void this.router.navigate(['/content/categories']);
        },
        error: (error) => {
          this.errorMessage = apiErrorMessage(
            error,
            'content.categories.edit.error',
          );
          this.submitting = false;
          this.changeDetector.detectChanges();
        },
      });
  }
}
