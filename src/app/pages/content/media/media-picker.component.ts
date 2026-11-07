import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { IconComponent } from '../../../components/icon/icon.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../../components/skeleton-list/skeleton-list.component';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import {
  Media,
  MediaService,
  mediaThumbnail,
} from '../../../services/media.service';
import { trimmedLength } from '../../../utils/form-validators.util';

/** theindex-api media/dto/alt-text.ts. */
export const ALT_TEXT_MAX = 250;
/** What the API decodes; anything else is a 400. */
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

export type MediaPickerMode = 'library' | 'upload';

/**
 * Chooses an image for an article (theindex-web docs/decision-record.md, section 9): from the
 * media library, or a new upload with its alt text. A modal <dialog>; `open()` resolves with the
 * chosen image, or null when it is closed. Used by the featured image and the image block.
 */
@Component({
  selector: 'app-media-picker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    IconComponent,
    EmptyStateComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './media-picker.component.html',
  styleUrl: './media-picker.component.scss',
})
export class MediaPickerComponent implements OnDestroy {
  readonly modes: SegmentedOption<MediaPickerMode>[] = [
    { value: 'library', label: 'content.media.picker.library' },
    { value: 'upload', label: 'content.media.picker.upload' },
  ];
  readonly accept = ACCEPTED_IMAGE_TYPES;
  readonly thumbnail = (media: Media) => mediaThumbnail(media, 480);

  mode: MediaPickerMode = 'library';
  items: Media[] = [];
  total = 0;
  page = 0;
  loading = false;
  loadError: UiMessage | null = null;
  selected: Media | null = null;

  file: File | null = null;
  fileTouched = false;
  previewUrl: string | null = null;
  uploading = false;
  uploadError: UiMessage | null = null;
  readonly uploadForm: FormGroup<{ altText: FormControl<string> }>;

  @ViewChild('dialog', { static: true })
  private readonly dialog!: ElementRef<HTMLDialogElement>;
  private resolveOpen: ((media: Media | null) => void) | null = null;
  private returnFocusTo: HTMLElement | null = null;
  private listRequest: Subscription | null = null;
  private uploadRequest: Subscription | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly mediaService: MediaService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.uploadForm = formBuilder.group({
      altText: formBuilder.nonNullable.control('', [
        Validators.required,
        trimmedLength(1, ALT_TEXT_MAX),
      ]),
    });
  }

  private get altText(): FormControl<string> {
    return this.uploadForm.controls.altText;
  }

  /** Shows the picker on the library. Resolves when an image is chosen or the picker closes. */
  open(): Promise<Media | null> {
    this.resolveOpen?.(null);
    this.cancelRequests();
    this.returnFocusTo = document.activeElement as HTMLElement | null;
    this.mode = 'library';
    this.selected = null;
    this.resetUpload();
    this.items = [];
    this.total = 0;
    this.page = 0;
    this.loadMore();
    if (!this.dialog.nativeElement.open) {
      this.dialog.nativeElement.showModal();
    }
    this.changeDetector.detectChanges();
    return new Promise((resolve) => {
      this.resolveOpen = resolve;
    });
  }

  close(): void {
    if (this.dialog.nativeElement.open) {
      this.dialog.nativeElement.close();
    } else {
      this.handleClose();
    }
  }

  ngOnDestroy(): void {
    this.cancelRequests();
    this.revokePreview();
    this.resolveOpen?.(null);
    this.resolveOpen = null;
  }

  setMode(mode: MediaPickerMode): void {
    this.mode = mode;
    this.changeDetector.detectChanges();
  }

  loadMore(): void {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.loadError = null;
    this.listRequest = this.mediaService.list(this.page + 1).subscribe({
      next: (page) => {
        this.items = [...this.items, ...page.items];
        this.total = page.total;
        this.page = page.page;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.loadError = apiErrorMessage(
          error,
          'content.media.picker.loadError',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  select(media: Media): void {
    this.selected = media;
    this.changeDetector.detectChanges();
  }

  useSelected(): void {
    if (this.selected) {
      this.finish(this.selected);
    }
  }

  fileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
    this.fileTouched = true;
    this.uploadError = null;
    this.revokePreview();
    if (this.file && typeof URL.createObjectURL === 'function') {
      this.previewUrl = URL.createObjectURL(this.file);
    }
    this.changeDetector.detectChanges();
  }

  get fileInvalid(): boolean {
    return this.fileTouched && !this.file;
  }

  get altTextInvalid(): boolean {
    return this.altText.touched && this.altText.invalid;
  }

  upload(): void {
    if (this.uploading) {
      return;
    }
    this.fileTouched = true;
    this.altText.markAsTouched();
    if (!this.file || this.altText.invalid) {
      this.changeDetector.detectChanges();
      return;
    }

    this.uploading = true;
    this.uploadError = null;
    this.uploadRequest = this.mediaService
      .upload(this.file, this.altText.value.trim())
      .subscribe({
        next: (media) => {
          this.uploading = false;
          this.finish(media);
        },
        error: (error) => {
          this.uploadError = apiErrorMessage(
            error,
            'content.media.picker.uploadError',
          );
          this.uploading = false;
          this.changeDetector.detectChanges();
        },
      });
  }

  // Fires for every close: the buttons, Escape and a backdrop click. Closing ends the session, so
  // an upload or a page of the library still on its way can't reach the next one.
  handleClose(): void {
    this.cancelRequests();
    this.revokePreview();
    const resolve = this.resolveOpen;
    this.resolveOpen = null;
    resolve?.(null);
    this.returnFocusTo?.focus();
    this.returnFocusTo = null;
  }

  // A click whose target is the <dialog> itself landed on the backdrop.
  handleDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog.nativeElement) {
      this.close();
    }
  }

  private finish(media: Media): void {
    const resolve = this.resolveOpen;
    this.resolveOpen = null;
    resolve?.(media);
    this.close();
  }

  private cancelRequests(): void {
    this.listRequest?.unsubscribe();
    this.uploadRequest?.unsubscribe();
    this.listRequest = null;
    this.uploadRequest = null;
    this.loading = false;
    this.uploading = false;
  }

  private resetUpload(): void {
    this.file = null;
    this.fileTouched = false;
    this.uploadError = null;
    this.uploading = false;
    this.altText.reset('');
    this.revokePreview();
  }

  private revokePreview(): void {
    if (this.previewUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = null;
  }
}
