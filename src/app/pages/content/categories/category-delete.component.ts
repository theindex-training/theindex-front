import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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

@Component({
  selector: 'app-category-delete',
  standalone: true,
  imports: [TranslocoPipe, UiMessagePipe, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './category-delete.component.html',
})
export class CategoryDeleteComponent implements OnInit {
  category: ArticleCategory | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly categoriesService: ArticleCategoriesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

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

  confirmDelete(): void {
    if (!this.category || this.submitting) {
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    this.categoriesService.delete(this.category.id).subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigate(['/content/categories']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'content.categories.delete.error',
        );
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
