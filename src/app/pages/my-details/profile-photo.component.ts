import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CropperPosition,
  Dimensions,
  ImageCropperComponent,
  LoadedImage,
} from 'ngx-image-cropper';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { IconComponent } from '../../components/icon/icon.component';
import { LanguageService } from '../../i18n/language.service';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  MyProfileService,
  PhotoCrop,
  PhotoRotation,
  ProfilePhoto,
} from '../../services/my-profile.service';
import {
  PHOTO_TYPES,
  Size,
  cornersFromCrop,
  cropFromImagePosition,
  photoFileProblem,
  turned,
} from './profile-photo';

/**
 * The profile photo section of My details: the photo (or initials), then Upload / Choose another,
 * Adjust the crop and Remove. Choosing a picture or adjusting opens the cropper (ngx-image-cropper,
 * a square, quarter turns); Save sends the picture with the square (`PUT`), or only the square for
 * the kept picture (`PATCH`). The API cuts the photo itself (theindex-api `/my-profile/photo`).
 */
@Component({
  selector: 'app-profile-photo',
  standalone: true,
  imports: [
    TranslocoPipe,
    UiMessagePipe,
    AvatarComponent,
    IconComponent,
    ImageCropperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './profile-photo.component.html',
  styleUrl: './profile-photo.component.scss',
})
export class ProfilePhotoComponent {
  @Input({ required: true }) name = '';
  @Input() photo: ProfilePhoto | null = null;
  @Output() readonly photoChange = new EventEmitter<ProfilePhoto | null>();

  @ViewChild(ImageCropperComponent) private cropper?: ImageCropperComponent;
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  readonly accept = PHOTO_TYPES.join(',');

  /** What the cropper edits: a newly chosen picture, or the kept one (adjusting the crop). */
  editing: 'new' | 'saved' | null = null;
  imageFile: File | null = null;
  rotation: PhotoRotation = 0;
  /** A saved crop to draw once the cropper knows its size. */
  private restore: PhotoCrop | null = null;
  /** Where the cropper draws its square (set only to restore a saved crop). */
  position: CropperPosition | undefined;
  /** The turned picture's size in pixels, from the cropper. */
  private imageSize: Size | null = null;
  ready = false;

  loadingOriginal = false;
  saving = false;
  removing = false;
  errorMessage: UiMessage | null = null;
  successMessage: UiMessage | null = null;

  private readonly profiles = inject(MyProfileService);
  private readonly language = inject(LanguageService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  get busy(): boolean {
    return this.saving || this.removing || this.loadingOriginal;
  }

  get frameLabel(): string {
    return this.language.t('myDetails.photo.frameLabel');
  }

  choose(): void {
    this.fileInput?.nativeElement.click();
  }

  /** A picture was chosen: checked, then opened in the cropper. */
  picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.clearMessages();
    const problem = photoFileProblem(file);
    if (problem) {
      this.errorMessage = i18nMessage(`myDetails.photo.${problem}`);
      return;
    }
    this.open('new', file, 0, null);
  }

  /** Opens the kept picture with the saved crop, to change it. */
  adjust(): void {
    if (!this.photo) return;
    const saved = this.photo.crop;
    this.clearMessages();
    this.loadingOriginal = true;
    this.profiles.photoOriginal().subscribe({
      next: (blob) => {
        this.loadingOriginal = false;
        const file = new File([blob], 'photo.jpg', {
          type: blob.type || 'image/jpeg',
        });
        this.open('saved', file, saved.rotation, saved);
      },
      error: (error: unknown) => {
        this.loadingOriginal = false;
        this.errorMessage = apiErrorMessage(error, 'myDetails.photo.loadError');
        this.changeDetector.detectChanges();
      },
    });
  }

  rotate(direction: 1 | -1): void {
    this.rotation = turned(this.rotation, direction);
    // A turned picture starts from the cropper's own square.
    this.restore = null;
    this.position = undefined;
    this.ready = false;
  }

  /** The cropper's box takes the turned picture's proportions. */
  get aspect(): number {
    return this.imageSize ? this.imageSize.width / this.imageSize.height : 1;
  }

  /**
   * The cropper has (re)loaded the picture: its size after turning. Its box is resized now, before
   * the cropper measures the picture it shows.
   */
  loaded(image: LoadedImage): void {
    this.imageSize = { ...image.transformed.size };
    this.changeDetector.detectChanges();
  }

  /** The cropper is shown at `shown` px: a saved crop is drawn now. */
  cropperReady(shown: Dimensions): void {
    if (this.restore) {
      const corners = cornersFromCrop(this.restore, shown);
      this.restore = null;
      this.position = corners;
    }
    this.ready = true;
    this.changeDetector.detectChanges();
  }

  loadFailed(): void {
    this.close();
    this.errorMessage = i18nMessage('myDetails.photo.unreadable');
    this.changeDetector.detectChanges();
  }

  cancel(): void {
    this.close();
  }

  save(): void {
    const result = this.cropper?.crop('base64');
    if (!result || !this.imageSize || !this.imageFile || !this.editing) {
      return;
    }
    const crop = cropFromImagePosition(
      result.imagePosition,
      this.imageSize,
      this.rotation,
    );
    this.clearMessages();
    this.saving = true;
    const request =
      this.editing === 'new'
        ? this.profiles.uploadPhoto(this.imageFile, crop)
        : this.profiles.recropPhoto(crop);
    request.subscribe({
      next: (photo) => {
        this.saving = false;
        this.close();
        this.photo = photo;
        this.successMessage = i18nMessage('myDetails.photo.saved');
        this.photoChange.emit(photo);
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.errorMessage = apiErrorMessage(error, 'myDetails.photo.saveError');
        this.changeDetector.detectChanges();
      },
    });
  }

  remove(): void {
    if (!window.confirm(this.language.t('myDetails.photo.removeConfirm'))) {
      return;
    }
    this.clearMessages();
    this.removing = true;
    this.profiles.removePhoto().subscribe({
      next: () => {
        this.removing = false;
        this.photo = null;
        this.successMessage = i18nMessage('myDetails.photo.removed');
        this.photoChange.emit(null);
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.removing = false;
        this.errorMessage = apiErrorMessage(
          error,
          'myDetails.photo.removeError',
        );
        this.changeDetector.detectChanges();
      },
    });
  }

  private open(
    editing: 'new' | 'saved',
    file: File,
    rotation: PhotoRotation,
    restore: PhotoCrop | null,
  ): void {
    this.editing = editing;
    this.imageFile = file;
    this.rotation = rotation;
    this.restore = restore;
    this.position = undefined;
    this.imageSize = null;
    this.ready = false;
    this.changeDetector.detectChanges();
  }

  private close(): void {
    this.editing = null;
    this.imageFile = null;
    this.restore = null;
    this.position = undefined;
    this.imageSize = null;
    this.ready = false;
  }

  private clearMessages(): void {
    this.errorMessage = null;
    this.successMessage = null;
  }
}
