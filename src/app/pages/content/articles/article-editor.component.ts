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
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '@environments/environment';
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
import { ConfirmDialogComponent } from '../confirm-dialog.component';
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
import { blocksKey } from './editor/article-content';
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

/** What the editor is doing besides autosaving; one at a time. */
export type ArticleAction =
  'publish' | 'preview' | 'unpublish' | 'discard' | 'delete';

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
 * top bar (back, save status, Preview, Publish or Update), the title and the Editor.js body, and a
 * settings panel that ends with Discard changes, Unpublish and Delete permanently. Every change is
 * autosaved to the draft; the published version changes only on Publish or Update.
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
    ConfirmDialogComponent,
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

  /** The lifecycle action on its way, if any. */
  busy: ArticleAction | null = null;
  /** The outcome of the last action: a success note, an error, or the API's publish problems. */
  actionNotice: UiMessage | null = null;
  actionError: UiMessage | null = null;
  publishProblems: string[] = [];

  readonly mediaHooks: BlockEditorMedia = {
    pick: () => this.picker.open(),
    resolve: (id) => this.resolveMedia(id),
  };

  @ViewChild(MediaPickerComponent, { static: true })
  private readonly picker!: MediaPickerComponent;
  @ViewChild(ConfirmDialogComponent, { static: true })
  private readonly confirmDialog!: ConfirmDialogComponent;
  @ViewChild(BlockEditorComponent)
  private readonly blockEditor?: BlockEditorComponent;

  private readonly autosaveDelay = inject(AUTOSAVE_DELAY);
  private readonly mediaCache = new Map<string, Promise<Media | null>>();
  private formChanges: Subscription | null = null;
  /** The stored body's blocks, to tell a real edit from Editor.js reporting one. */
  private savedBlocks = '';
  /** Set once the article is deleted, so leaving doesn't try to save it. */
  private deleted = false;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly articlesService: ArticlesService,
    private readonly categoriesService: ArticleCategoriesService,
    private readonly mediaService: MediaService,
    private readonly language: LanguageService,
    private readonly formats: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
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

  /** The label of the main button: Publish, Publish again or Update. */
  get publishKey(): string {
    switch (this.article?.status) {
      case 'PUBLISHED':
        return 'content.articles.actions.update';
      case 'UNPUBLISHED':
        return 'content.articles.actions.republish';
      default:
        return 'content.articles.actions.publish';
    }
  }

  /** "Update" has nothing to do while the site already shows the draft. */
  get canPublish(): boolean {
    const article = this.article;
    if (!article || !this.autosave || this.busy) {
      return false;
    }
    if (this.autosave.status() === 'conflict') {
      return false;
    }
    return (
      article.status !== 'PUBLISHED' ||
      article.hasUnpublishedChanges ||
      this.autosave.hasUnsavedChanges
    );
  }

  /** The article's page on the public site, once it has an address. */
  get siteUrl(): string | null {
    return this.article?.slug
      ? `${environment.publicSiteUrl}/articles/${this.article.slug}`
      : null;
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

  /**
   * Publish, publish again or Update: saves what is left first (the API publishes the draft at the
   * revision this page has), then shows what went live, or the list of problems to fix.
   */
  async publish(): Promise<void> {
    const article = this.article;
    const autosave = this.autosave;
    if (!article || !autosave || this.busy) {
      return;
    }
    this.begin('publish');
    if (!(await autosave.save())) {
      this.fail(i18nMessage('content.articles.actions.saveFirst'));
      return;
    }
    const wasPublished = article.status === 'PUBLISHED';
    this.articlesService.publish(article.id, autosave.revision).subscribe({
      next: (published) => {
        this.applyLifecycle(published);
        this.succeed(
          wasPublished
            ? 'content.articles.actions.updated'
            : 'content.articles.actions.published',
        );
      },
      error: (error: unknown) => {
        const message = (error as HttpErrorResponse).error as {
          message?: unknown;
        } | null;
        if (
          error instanceof HttpErrorResponse &&
          error.status === 400 &&
          Array.isArray(message?.message)
        ) {
          this.publishProblems = message.message.map(String);
          this.fail(null);
        } else {
          this.fail(
            apiErrorMessage(error, 'content.articles.actions.publishError'),
          );
        }
      },
    });
  }

  /**
   * Opens the public site's preview of the draft in a new tab, after saving what is left. The tab
   * is opened right away, in the click, so the browser doesn't block it as a pop-up; it gets its
   * address when the token arrives.
   */
  async preview(): Promise<void> {
    const article = this.article;
    if (!article || !this.autosave || this.busy) {
      return;
    }
    const tab = window.open('', '_blank');
    if (tab) {
      tab.opener = null;
    }
    this.begin('preview');
    const saved = await this.autosave.save();
    this.articlesService.createPreviewToken(article.id).subscribe({
      next: ({ token }) => {
        const url = `${environment.publicSiteUrl}/preview?token=${encodeURIComponent(token)}`;
        if (tab) {
          tab.location.href = url;
        } else {
          window.open(url, '_blank', 'noopener');
        }
        if (saved) {
          this.succeed(null);
        } else {
          this.fail(i18nMessage('content.articles.actions.previewUnsaved'));
        }
      },
      error: (error) => {
        tab?.close();
        this.fail(
          apiErrorMessage(error, 'content.articles.actions.previewError'),
        );
      },
    });
  }

  /** Takes the article off the site, after a confirmation. The published version is kept. */
  async unpublish(): Promise<void> {
    const article = this.article;
    if (!article || this.busy) {
      return;
    }
    const confirmed = await this.confirmDialog.ask({
      title: 'content.articles.confirm.unpublish.title',
      message: 'content.articles.confirm.unpublish.message',
      confirm: 'content.articles.confirm.unpublish.confirm',
    });
    if (!confirmed) {
      return;
    }
    this.begin('unpublish');
    this.articlesService.unpublish(article.id).subscribe({
      next: (unpublished) => {
        this.applyLifecycle(unpublished);
        this.succeed('content.articles.actions.unpublished');
      },
      error: (error) =>
        this.fail(
          apiErrorMessage(error, 'content.articles.actions.unpublishError'),
        ),
    });
  }

  /** Throws the draft's changes away, after a confirmation: the editor shows the live version. */
  async discard(): Promise<void> {
    const article = this.article;
    const autosave = this.autosave;
    if (!article || !autosave || this.busy) {
      return;
    }
    const confirmed = await this.confirmDialog.ask({
      title: 'content.articles.confirm.discard.title',
      message: 'content.articles.confirm.discard.message',
      confirm: 'content.articles.confirm.discard.confirm',
    });
    if (!confirmed) {
      return;
    }
    this.begin('discard');
    // A save on its way would move the revision; wait for it, so the discard isn't refused.
    await autosave.save();
    this.articlesService.discardDraft(article.id, autosave.revision).subscribe({
      next: (restored) => {
        this.restart(restored);
        this.succeed('content.articles.actions.discarded');
      },
      error: (error) =>
        this.fail(
          apiErrorMessage(error, 'content.articles.actions.discardError'),
        ),
    });
  }

  /** Deletes a draft or an unpublished article for good, after a confirmation. */
  async deleteArticle(): Promise<void> {
    const article = this.article;
    if (!article || this.busy || article.status === 'PUBLISHED') {
      return;
    }
    const confirmed = await this.confirmDialog.ask({
      title: 'content.articles.confirm.delete.title',
      message: 'content.articles.confirm.delete.message',
      confirm: 'content.articles.confirm.delete.confirm',
    });
    if (!confirmed) {
      return;
    }
    this.begin('delete');
    this.articlesService.delete(article.id).subscribe({
      next: () => {
        this.deleted = true;
        this.autosave?.stop();
        this.busy = null;
        void this.router.navigate(['/content/articles']);
      },
      error: (error) =>
        this.fail(
          apiErrorMessage(error, 'content.articles.actions.deleteError'),
        ),
    });
  }

  dismissNotice(): void {
    this.actionNotice = null;
    this.actionError = null;
    this.publishProblems = [];
    this.changeDetector.detectChanges();
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
    if (this.deleted || !this.autosave?.hasUnsavedChanges) {
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

  private begin(action: ArticleAction): void {
    this.busy = action;
    this.actionNotice = null;
    this.actionError = null;
    this.publishProblems = [];
    this.changeDetector.detectChanges();
  }

  private succeed(noticeKey: string | null): void {
    this.busy = null;
    this.actionNotice = noticeKey ? i18nMessage(noticeKey) : null;
    this.changeDetector.detectChanges();
  }

  private fail(error: UiMessage | null): void {
    this.busy = null;
    this.actionError = error;
    this.changeDetector.detectChanges();
  }

  /**
   * The answer of publish or unpublish. Their draftRevision is the one they acted on, so if the
   * draft was saved again meanwhile (or waits to be), the site doesn't show it yet.
   */
  private applyLifecycle(article: Article): void {
    const newer =
      !!this.autosave &&
      (this.autosave.revision !== article.draftRevision ||
        this.autosave.hasUnsavedChanges);
    this.article = {
      ...article,
      hasUnpublishedChanges: article.hasUnpublishedChanges || newer,
    };
  }

  /** Rebuilds the form and the body from the API's answer (after Discard changes). */
  private restart(article: Article): void {
    this.autosave?.stop();
    this.formChanges?.unsubscribe();
    this.autosave = null;
    this.article = null;
    this.form = null;
    this.changeDetector.detectChanges();
    this.start(article);
  }

  private start(article: Article): void {
    this.article = article;
    this.savedBlocks = blocksKey(article.draft.content);
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
        this.savedBlocks = blocksKey(saved.draft.content);
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
            const content = await this.blockEditor.save();
            // Editor.js also reports changes that leave the text as it was (new block ids,
            // layout); saving those would mark a published article as changed for nothing.
            if (blocksKey(content) !== this.savedBlocks) {
              changes.content = content;
            }
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
