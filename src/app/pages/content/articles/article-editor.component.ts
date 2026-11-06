import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  inject,
  InjectionToken,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom, Subscription } from 'rxjs';
import { IconComponent } from '../../../components/icon/icon.component';
import { EnumLabelPipe } from '../../../i18n/enum-label.pipe';
import { LanguageService } from '../../../i18n/language.service';
import { LocaleFormatService } from '../../../i18n/locale-format.service';
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
import {
  Article,
  ArticlesService,
  SaveDraftChanges,
} from '../../../services/articles.service';
import {
  Media,
  MediaService,
  mediaThumbnail,
} from '../../../services/media.service';
import { MediaPickerComponent } from '../media/media-picker.component';
import { LeavesSafely } from './leave-editor.guard';
import {
  ARTICLE_EXCERPT_MAX,
  ARTICLE_MAX_CATEGORIES,
  ARTICLE_SEO_DESCRIPTION_MAX,
  ARTICLE_SEO_TITLE_MAX,
  ArticleTextField,
  ArticleTextForm,
  buildArticleTextForm,
  textFieldChange,
} from './article-form';
import {
  BlockEditorComponent,
  BlockEditorMedia,
} from './editor/block-editor.component';
import {
  CollectedChanges,
  DraftAutosave,
  DraftField,
  SaveStatus,
} from './editor/draft-autosave';

/** How long autosave waits after the last change: about 2 seconds (the decision record). */
export const AUTOSAVE_DELAY = new InjectionToken<number>('AUTOSAVE_DELAY', {
  providedIn: 'root',
  factory: () => 2000,
});

const TEXT_FIELDS: ArticleTextField[] = [
  'title',
  'slug',
  'excerpt',
  'seoTitle',
  'seoDescription',
];

const STATUS_KEYS: Record<SaveStatus, string> = {
  saved: 'content.articles.editor.save.saved',
  pending: 'content.articles.editor.save.pending',
  saving: 'content.articles.editor.save.saving',
  invalid: 'content.articles.editor.save.invalid',
  error: 'content.articles.editor.save.failed',
  conflict: 'content.articles.editor.save.notSaved',
};

/**
 * The article editor (theindex-web docs/decision-record.md, section 9): a full-screen page with a
 * top bar (back, save status), the title and the Editor.js body, and a settings panel. Every
 * change is autosaved to the draft; the published version changes only on Publish (item 11).
 */
@Component({
  selector: 'app-article-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    IconComponent,
    BlockEditorComponent,
    MediaPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './article-editor.component.html',
  styleUrl: './article-editor.component.scss',
})
export class ArticleEditorComponent implements OnInit, OnDestroy, LeavesSafely {
  readonly limits = {
    excerpt: ARTICLE_EXCERPT_MAX,
    seoTitle: ARTICLE_SEO_TITLE_MAX,
    seoDescription: ARTICLE_SEO_DESCRIPTION_MAX,
    categories: ARTICLE_MAX_CATEGORIES,
  };
  readonly thumbnail = (media: Media) => mediaThumbnail(media, 480);

  articleId: string | null = null;
  article: Article | null = null;
  form: ArticleTextForm | null = null;
  autosave: DraftAutosave | null = null;
  loading = true;
  loadError: UiMessage | null = null;

  categories: ArticleCategory[] = [];
  categoriesLoading = true;
  categoriesError: UiMessage | null = null;
  categoryIds: string[] = [];

  featuredMediaId: string | null = null;
  featuredMedia: Media | null = null;
  featuredMediaMissing = false;

  readonly mediaHooks: BlockEditorMedia = {
    pick: () => this.picker.open(),
    resolve: (id) => this.resolveMedia(id),
  };

  @ViewChild(MediaPickerComponent, { static: true })
  private readonly picker!: MediaPickerComponent;
  @ViewChild(BlockEditorComponent)
  private readonly blockEditor?: BlockEditorComponent;

  private readonly autosaveDelay = inject(AUTOSAVE_DELAY);
  private readonly mediaCache = new Map<string, Promise<Media | null>>();
  private formChanges: Subscription | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly articlesService: ArticlesService,
    private readonly categoriesService: ArticleCategoriesService,
    private readonly mediaService: MediaService,
    private readonly language: LanguageService,
    private readonly formats: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.articleId = this.route.snapshot.paramMap.get('id');
    if (!this.articleId) {
      this.loadError = i18nMessage('content.articles.errors.missingId');
      this.loading = false;
      return;
    }
    this.load();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.autosave?.stop();
    this.formChanges?.unsubscribe();
  }

  /** The text of the save status in the top bar. */
  get statusKey(): string {
    return STATUS_KEYS[this.autosave?.status() ?? 'saved'];
  }

  get published(): boolean {
    return !!this.article?.firstPublishedAt;
  }

  lastSaved(): string {
    return this.formats.dateTime(this.article?.draftUpdatedAt);
  }

  showError(field: ArticleTextField): boolean {
    const control = this.form?.controls[field];
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  length(field: ArticleTextField): number {
    return this.form?.controls[field].value.trim().length ?? 0;
  }

  /** Throws the local state away and loads the article again (after a 409). */
  load(): void {
    if (!this.articleId) {
      return;
    }
    this.autosave?.stop();
    this.formChanges?.unsubscribe();
    this.autosave = null;
    this.article = null;
    this.form = null;
    this.loading = true;
    this.loadError = null;
    this.changeDetector.detectChanges();

    this.articlesService.getById(this.articleId).subscribe({
      next: (article) => this.start(article),
      error: (error) => {
        this.loadError = apiErrorMessage(error, 'content.articles.errors.load');
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  loadCategories(): void {
    this.categoriesLoading = true;
    this.categoriesError = null;
    this.categoriesService.list().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.categoriesLoading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.categoriesError = apiErrorMessage(
          error,
          'content.articles.settings.categoriesError',
        );
        this.categoriesLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  contentChanged(): void {
    this.autosave?.change('content');
  }

  isCategoryChecked(id: string): boolean {
    return this.categoryIds.includes(id);
  }

  /** Unchecked boxes are disabled once the draft has the most categories the API accepts. */
  isCategoryDisabled(id: string): boolean {
    return (
      !this.isCategoryChecked(id) &&
      this.categoryIds.length >= ARTICLE_MAX_CATEGORIES
    );
  }

  toggleCategory(id: string, checked: boolean): void {
    this.categoryIds = checked
      ? [...this.categoryIds.filter((c) => c !== id), id]
      : this.categoryIds.filter((c) => c !== id);
    this.autosave?.change('categoryIds');
    this.changeDetector.detectChanges();
  }

  async chooseFeaturedImage(): Promise<void> {
    const media = await this.picker.open();
    if (!media) {
      return;
    }
    this.mediaCache.set(media.id, Promise.resolve(media));
    this.featuredMediaId = media.id;
    this.featuredMedia = media;
    this.featuredMediaMissing = false;
    this.autosave?.change('featuredMediaId');
    this.changeDetector.detectChanges();
  }

  removeFeaturedImage(): void {
    this.featuredMediaId = null;
    this.featuredMedia = null;
    this.featuredMediaMissing = false;
    this.autosave?.change('featuredMediaId');
    this.changeDetector.detectChanges();
  }

  retrySave(): void {
    void this.autosave?.save();
  }

  /** The title is one line: Enter doesn't add a line break. */
  preventLineBreak(event: Event): void {
    event.preventDefault();
  }

  /**
   * The leave guard: saves what is left, and asks before leaving when that fails (an error, a
   * field with an error, or a 409).
   */
  async canLeave(): Promise<boolean> {
    if (!this.autosave?.hasUnsavedChanges) {
      return true;
    }
    if (await this.autosave.save()) {
      return true;
    }
    return window.confirm(
      this.language.t('content.articles.editor.leaveUnsaved'),
    );
  }

  /** Closing the tab or reloading with unsaved changes: the browser asks, and a save starts. */
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.autosave?.hasUnsavedChanges) {
      void this.autosave.save();
      event.preventDefault();
    }
  }

  private start(article: Article): void {
    this.article = article;
    const form = buildArticleTextForm(this.formBuilder, article.draft);
    this.form = form;
    this.categoryIds = [...article.draft.categoryIds];
    this.featuredMediaId = article.draft.featuredMediaId;
    this.featuredMedia = null;
    this.featuredMediaMissing = false;

    this.autosave = new DraftAutosave({
      revision: article.draftRevision,
      delayMs: this.autosaveDelay,
      collect: (fields) => this.collect(fields),
      send: (payload) => this.articlesService.saveDraft(article.id, payload),
      saved: (saved) => {
        this.article = saved;
        this.changeDetector.detectChanges();
      },
    });

    this.formChanges = new Subscription();
    for (const field of TEXT_FIELDS) {
      this.formChanges.add(
        form.controls[field].valueChanges.subscribe(() =>
          this.autosave?.change(field),
        ),
      );
    }

    this.loading = false;
    this.changeDetector.detectChanges();

    if (this.featuredMediaId) {
      const id = this.featuredMediaId;
      void this.resolveMedia(id).then((media) => {
        if (this.featuredMediaId !== id) {
          return;
        }
        this.featuredMedia = media;
        this.featuredMediaMissing = !media;
        this.changeDetector.detectChanges();
      });
    }
  }

  /** What autosave sends for these fields; text fields with an error wait until they are fixed. */
  private async collect(
    fields: ReadonlySet<DraftField>,
  ): Promise<CollectedChanges> {
    const changes: SaveDraftChanges = {};
    const invalid: DraftField[] = [];
    const form = this.form;

    for (const field of fields) {
      switch (field) {
        case 'content':
          if (this.blockEditor) {
            changes.content = await this.blockEditor.save();
          }
          break;
        case 'categoryIds':
          changes.categoryIds = [...this.categoryIds];
          break;
        case 'featuredMediaId':
          changes.featuredMediaId = this.featuredMediaId;
          break;
        default: {
          // The slug is fixed after the first publish, and the API refuses it then.
          if (!form || (field === 'slug' && this.published)) {
            break;
          }
          const value = textFieldChange(form, field);
          if (value === undefined) {
            form.controls[field].markAsTouched();
            invalid.push(field);
          } else if (field === 'title') {
            changes.title = value ?? '';
          } else {
            changes[field] = value;
          }
        }
      }
    }
    if (invalid.length) {
      this.changeDetector.detectChanges();
    }
    return { changes, invalid };
  }

  private resolveMedia(id: string): Promise<Media | null> {
    let cached = this.mediaCache.get(id);
    if (!cached) {
      cached = firstValueFrom(this.mediaService.getById(id)).catch(() => null);
      this.mediaCache.set(id, cached);
    }
    return cached;
  }
}
