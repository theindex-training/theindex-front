import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { ListRowComponent } from '../../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../../components/skeleton-list/skeleton-list.component';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import { ContentNavComponent } from '../content-nav.component';
import {
  ArticleCategoriesService,
  ArticleCategory,
} from '../../../services/article-categories.service';

/** Article categories in menu order (the API sorts them). Each row opens the edit page. */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    ContentNavComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ListRowComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './categories.component.html',
})
export class CategoriesComponent implements OnInit {
  categories: ArticleCategory[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly categoriesService: ArticleCategoriesService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    this.categoriesService.list().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'content.categories.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
