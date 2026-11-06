import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  untracked,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import Delimiter from '@editorjs/delimiter';
import EditorJS, { I18nDictionary, OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import { LanguageService } from '../../../../i18n/language.service';
import { ArticleContent } from '../../../../services/articles.service';
import { Media } from '../../../../services/media.service';
import { fromEditorData, toEditorData } from './article-content';
import {
  ArticleImageTool,
  ArticleListTool,
  ArticleQuoteTool,
  ArticleVideoTool,
  ImageToolConfig,
  VideoToolConfig,
} from './editor-tools';

/** The media library hooks the image block needs (the page's media picker). */
export interface BlockEditorMedia {
  pick: () => Promise<Media | null>;
  resolve: (id: string) => Promise<Media | null>;
}

/**
 * Editor.js for an article's body (theindex-web docs/decision-record.md, section 7), with only the
 * blocks theindex-api accepts. Emits `changed` on every edit; the page reads the content with
 * `save()` when it autosaves. A language switch rebuilds the editor around the current content,
 * because Editor.js reads its UI text once.
 */
@Component({
  selector: 'app-block-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  // Editor.js builds its own DOM, so its overrides can't be scoped by Angular.
  encapsulation: ViewEncapsulation.None,
  template: `<div
    #holder
    class="block-editor"
    data-testid="article-body"
    role="group"
    [attr.aria-label]="label"
  ></div>`,
  styleUrl: './block-editor.component.scss',
})
export class BlockEditorComponent implements AfterViewInit, OnDestroy {
  /** The stored content to start from. */
  @Input({ required: true }) content: ArticleContent | null = null;
  @Input({ required: true }) media!: BlockEditorMedia;
  /** Accessible name of the editing area (translated). */
  @Input() label = '';
  @Output() readonly changed = new EventEmitter<void>();
  /** Every rebuild, once the editor can be used. */
  @Output() readonly ready = new EventEmitter<void>();

  @ViewChild('holder', { static: true })
  private readonly holder!: ElementRef<HTMLElement>;

  private editor: EditorJS | null = null;
  private whenReady: Promise<void> = Promise.resolve();
  private destroyed = false;

  constructor(private readonly language: LanguageService) {
    let first = true;
    effect(() => {
      this.language.lang();
      if (first) {
        first = false;
        return;
      }
      untracked(() => void this.rebuild());
    });
  }

  ngAfterViewInit(): void {
    this.create(toEditorData(this.content));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.editor?.destroy();
    this.editor = null;
  }

  /** The current content, as the autosave sends it. Empty blocks are left out. */
  async save(): Promise<ArticleContent> {
    await this.whenReady;
    if (!this.editor) {
      throw new Error('The editor is not available');
    }
    return fromEditorData(await this.editor.save());
  }

  private create(data: OutputData): void {
    const t = (key: string) => this.language.t(key);
    const imageConfig: ImageToolConfig = {
      labels: {
        choose: t('content.articles.blocks.imageChoose'),
        replace: t('content.articles.blocks.imageReplace'),
        caption: t('content.articles.blocks.caption'),
        missing: t('content.articles.blocks.imageMissing'),
        altText: t('content.articles.blocks.altText'),
      },
      pick: () => this.media.pick(),
      resolve: (id) => this.media.resolve(id),
    };
    const videoConfig: VideoToolConfig = {
      labels: {
        link: t('content.articles.blocks.videoLink'),
        linkHint: t('content.articles.blocks.videoLinkHint'),
        invalidLink: t('content.articles.blocks.videoInvalid'),
        caption: t('content.articles.blocks.caption'),
        thumbnail: t('content.articles.blocks.videoThumbnail'),
        open: t('content.articles.blocks.videoOpen'),
      },
    };

    const editor = new EditorJS({
      holder: this.holder.nativeElement,
      data,
      placeholder: t('content.articles.blocks.placeholder'),
      minHeight: 160,
      i18n: { messages: this.dictionary() },
      tools: {
        header: {
          class: Header as never,
          inlineToolbar: true,
          config: {
            levels: [2, 3],
            defaultLevel: 2,
            placeholder: t('content.articles.blocks.heading'),
          },
        },
        list: {
          class: ArticleListTool as never,
          inlineToolbar: true,
          config: { defaultStyle: 'unordered', maxLevel: 3 },
        },
        quote: {
          class: ArticleQuoteTool as never,
          inlineToolbar: true,
          config: {
            quotePlaceholder: t('content.articles.blocks.quote'),
            captionPlaceholder: t('content.articles.blocks.quoteCaption'),
          },
        },
        image: { class: ArticleImageTool as never, config: imageConfig },
        embed: { class: ArticleVideoTool as never, config: videoConfig },
        delimiter: Delimiter as never,
      },
      onChange: () => this.changed.emit(),
    });
    this.editor = editor;
    this.whenReady = editor.isReady.then(() => {
      if (!this.destroyed) {
        this.ready.emit();
      }
    });
  }

  /** Rebuilds the editor in the new language, keeping what was typed. */
  private async rebuild(): Promise<void> {
    const previous = this.editor;
    if (!previous || this.destroyed) {
      return;
    }
    const pending = this.whenReady.then(async () => {
      const data = await previous.save();
      previous.destroy();
      if (!this.destroyed) {
        this.create(data);
        await this.whenReady;
      }
    });
    this.whenReady = pending;
    await pending;
  }

  /** Editor.js's own UI text (toolbox, menus, tunes), from the translation files. */
  private dictionary(): I18nDictionary {
    const t = (key: string) => this.language.t(key);
    return {
      ui: {
        blockTunes: {
          toggler: {
            'Click to tune': t('content.articles.blocks.tune'),
            'or drag to move': t('content.articles.blocks.drag'),
          },
        },
        inlineToolbar: {
          converter: { 'Convert to': t('content.articles.blocks.convertTo') },
        },
        toolbar: { toolbox: { Add: t('content.articles.blocks.add') } },
        popover: {
          Filter: t('content.articles.blocks.filter'),
          'Nothing found': t('content.articles.blocks.nothingFound'),
          'Convert to': t('content.articles.blocks.convertTo'),
        },
      },
      toolNames: {
        Text: t('content.articles.blocks.text'),
        Heading: t('content.articles.blocks.heading'),
        'Unordered List': t('content.articles.blocks.unorderedList'),
        'Ordered List': t('content.articles.blocks.orderedList'),
        Quote: t('content.articles.blocks.quote'),
        Delimiter: t('content.articles.blocks.delimiter'),
        Image: t('content.articles.blocks.image'),
        Video: t('content.articles.blocks.video'),
        Link: t('content.articles.blocks.link'),
        Bold: t('content.articles.blocks.bold'),
        Italic: t('content.articles.blocks.italic'),
      },
      tools: {
        header: {
          'Heading 2': t('content.articles.blocks.heading2'),
          'Heading 3': t('content.articles.blocks.heading3'),
        },
        list: {
          Unordered: t('content.articles.blocks.unordered'),
          Ordered: t('content.articles.blocks.ordered'),
        },
        link: { 'Add a link': t('content.articles.blocks.addLink') },
        stub: {
          'The block can not be displayed correctly.': t(
            'content.articles.blocks.stub',
          ),
        },
      },
      blockTunes: {
        delete: {
          Delete: t('content.articles.blocks.delete'),
          'Click to delete': t('content.articles.blocks.confirmDelete'),
        },
        moveUp: { 'Move up': t('content.articles.blocks.moveUp') },
        moveDown: { 'Move down': t('content.articles.blocks.moveDown') },
      },
    };
  }
}
