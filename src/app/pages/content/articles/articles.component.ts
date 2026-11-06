import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, Subject, Subscription } from 'rxjs';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { ListRowComponent } from '../../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { SearchFieldComponent } from '../../../components/search-field/search-field.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../../components/skeleton-list/skeleton-list.component';
import { StatusDotComponent } from '../../../components/status-dot/status-dot.component';
import { EnumLabelPipe } from '../../../i18n/enum-label.pipe';
import { LanguageService } from '../../../i18n/language.service';
import { LocaleFormatService } from '../../../i18n/locale-format.service';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import { ArticleCategoriesService } from '../../../services/article-categories.service';
import {
  ArticleStatus,
  ArticleSummary,
  ArticlesService,
} from '../../../services/articles.service';
import { ContentNavComponent } from '../content-nav.component';

export type ArticleStatusFilter = 'all' | ArticleStatus;

/** Rows per request; "Show more" asks for the next page. */
export const ARTICLES_PAGE_SIZE = 20;
/** Searching waits this long after the last keystroke. */
export const ARTICLES_SEARCH_DELAY_MS = 300;

const STATUS_TONES: Record<ArticleStatus, 'success' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  UNPUBLISHED: 'warning',
};

/**
 * The articles of the public site, most recently changed first. The API filters and searches (the
 * draft title), page by page; each row opens the editor.
 */
@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
    ContentNavComponent,
    SearchFieldComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ListRowComponent,
    StatusDotComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './articles.component.html',
})
export class ArticlesComponent implements OnInit, OnDestroy {
  readonly statusOptions: SegmentedOption<ArticleStatusFilter>[] = [
    { value: 'all', label: 'common.all' },
    { value: 'DRAFT', label: 'content.articles.list.filter.DRAFT' },
    { value: 'PUBLISHED', label: 'content.articles.list.filter.PUBLISHED' },
    { value: 'UNPUBLISHED', label: 'content.articles.list.filter.UNPUBLISHED' },
  ];

  articles: ArticleSummary[] = [];
  total = 0;
  page = 0;
  status: ArticleStatusFilter = 'all';
  searchTerm = '';
  loading = true;
  loadingMore = false;
  errorMessage: UiMessage | null = null;
  moreError: UiMessage | null = null;
  categoryNames = new Map<string, string>();

  private readonly searchTerms = new Subject<void>();
  private readonly subscriptions = new Subscription();
  private request: Subscription | null = null;

  constructor(
    private readonly articlesService: ArticlesService,
    private readonly categoriesService: ArticleCategoriesService,
    private readonly language: LanguageService,
    private readonly formats: LocaleFormatService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.searchTerms
        .pipe(debounceTime(ARTICLES_SEARCH_DELAY_MS))
        .subscribe(() => this.load()),
    );
    this.load();
    // Only for showing names in the rows; the list works without them.
    this.categoriesService.list().subscribe({
      next: (categories) => {
        this.categoryNames = new Map(categories.map((c) => [c.id, c.name]));
        this.changeDetector.detectChanges();
      },
      error: () => undefined,
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.request?.unsubscribe();
  }

  get filtered(): boolean {
    return this.status !== 'all';
  }

  /** The first page for the current filter and search; a newer call cancels an older one. */
  load(): void {
    this.loading = true;
    this.errorMessage = null;
    this.moreError = null;
    this.request?.unsubscribe();
    this.request = this.articlesService.list(this.query(1)).subscribe({
      next: (page) => {
        this.articles = page.items;
        this.total = page.total;
        this.page = page.page;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'content.articles.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore) {
      return;
    }
    this.loadingMore = true;
    this.moreError = null;
    this.request = this.articlesService
      .list(this.query(this.page + 1))
      .subscribe({
        next: (page) => {
          const known = new Set(this.articles.map((a) => a.id));
          this.articles = [
            ...this.articles,
            ...page.items.filter((a) => !known.has(a.id)),
          ];
          this.total = page.total;
          this.page = page.page;
          this.loadingMore = false;
          this.changeDetector.detectChanges();
        },
        error: (error) => {
          this.moreError = apiErrorMessage(
            error,
            'content.articles.list.loadErrorMessage',
          );
          this.loadingMore = false;
          this.changeDetector.detectChanges();
        },
      });
  }

  setStatus(status: ArticleStatusFilter): void {
    this.status = status;
    this.load();
  }

  setSearch(term: string): void {
    this.searchTerm = term;
    if (term.trim()) {
      this.searchTerms.next();
    } else {
      // Clearing shows everything again at once.
      this.load();
    }
  }

  showAll(): void {
    this.status = 'all';
    this.load();
  }

  clearSearch(): void {
    this.setSearch('');
  }

  titleOf(article: ArticleSummary): string {
    return article.title.trim() || this.language.t('content.articles.untitled');
  }

  categoriesOf(article: ArticleSummary): string {
    return article.categoryIds
      .map((id) => this.categoryNames.get(id))
      .filter((name): name is string => !!name)
      .join(', ');
  }

  tone(status: ArticleStatus): 'success' | 'warning' | 'neutral' {
    return STATUS_TONES[status];
  }

  changedAt(article: ArticleSummary): string {
    return this.formats.dateTime(article.updatedAt);
  }

  private query(page: number) {
    return {
      status: this.status === 'all' ? undefined : this.status,
      // The API takes up to 100 characters.
      search: this.searchTerm.trim().slice(0, 100) || undefined,
      page,
      pageSize: ARTICLES_PAGE_SIZE,
    };
  }
}
