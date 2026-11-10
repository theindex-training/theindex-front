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
import EditorJS, { I18nDictionary, OutputData } from '@editorjs/editorjs';
import { LanguageService } from '../../i18n/language.service';
import { WorkoutSummary } from '../../services/workouts.service';
import { summaryFromEditor } from './workout-summary';

/**
 * Editor.js for a workout's summary: paragraphs only, with bold and italic (theindex-api keeps
 * nothing else). The page reads it with `save()` when the form is submitted, and puts a PDF's
 * summary in with `load()`. Like the article editor, a language switch rebuilds it around what
 * was typed, because Editor.js reads its UI text once.
 */
@Component({
  selector: 'app-summary-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  // Editor.js builds its own DOM, so its overrides can't be scoped by Angular. The article
  // editor's rules map Editor.js's light-only styles onto the tokens; they all start with
  // .block-editor.
  encapsulation: ViewEncapsulation.None,
  template: `<div
    #holder
    class="block-editor summary-editor"
    data-testid="workout-summary"
    role="group"
    [attr.aria-label]="label"
    [attr.aria-describedby]="describedBy || null"
    [class.summary-editor--invalid]="invalid"
  ></div>`,
  styleUrls: [
    '../content/articles/editor/block-editor.component.scss',
    './summary-editor.component.scss',
  ],
})
export class SummaryEditorComponent implements AfterViewInit, OnDestroy {
  /** The stored summary to start from. */
  @Input() content: WorkoutSummary | null = null;
  /** Accessible name of the editing area (translated). */
  @Input() label = '';
  @Input() describedBy = '';
  @Input() invalid = false;
  @Output() readonly changed = new EventEmitter<void>();

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

  /** What is typed, as the API takes it: paragraphs, empty ones left out. */
  async save(): Promise<WorkoutSummary> {
    await this.whenReady;
    if (!this.editor) {
      throw new Error('The editor is not available');
    }
    return summaryFromEditor(await this.editor.save());
  }

  /** Replaces what is typed (a summary read from a PDF). */
  async load(content: WorkoutSummary | null): Promise<void> {
    await this.whenReady;
    const editor = this.editor;
    if (!editor || this.destroyed) {
      return;
    }
    const data = toEditorData(content);
    if (data.blocks.length) {
      await editor.render(data);
    } else {
      editor.clear();
    }
  }

  private create(data: OutputData): void {
    const editor = new EditorJS({
      holder: this.holder.nativeElement,
      data,
      placeholder: this.language.t('workouts.form.summaryPlaceholder'),
      minHeight: 40,
      // Only the text block exists; bold and italic are its only formatting.
      inlineToolbar: ['bold', 'italic'],
      i18n: { messages: this.dictionary() },
      onChange: () => this.changed.emit(),
    });
    this.editor = editor;
    this.whenReady = editor.isReady;
  }

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

  /** Editor.js's own UI text; the article editor's translations say the same things. */
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
        Bold: t('content.articles.blocks.bold'),
        Italic: t('content.articles.blocks.italic'),
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

function toEditorData(content: WorkoutSummary | null): OutputData {
  return {
    ...(content?.time ? { time: content.time } : {}),
    ...(content?.version ? { version: content.version } : {}),
    blocks: (content?.blocks ?? []).map((block) => ({
      ...(block.id ? { id: block.id } : {}),
      type: 'paragraph',
      data: { text: block.data.text },
    })),
  };
}
