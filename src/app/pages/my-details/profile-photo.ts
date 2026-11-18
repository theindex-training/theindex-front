import { PhotoCrop, PhotoRotation } from '../../services/my-profile.service';

/**
 * The profile photo editor's model (pure). The cropper (ngx-image-cropper) shows the picture
 * turned by `rotation` and a square on it; the API wants that square as fractions of the turned
 * picture (theindex-api `PhotoCropDto`), so it can cut it from the picture it keeps, whatever size
 * the browser showed it at.
 */

/** What the API accepts (theindex-api `profile-photo-processing.ts`). */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** MEDIA_MAX_UPLOAD_MB's default on the API. */
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** A rectangle as the cropper gives it: corners in pixels. */
export interface Corners {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Why a chosen file can't be used, before sending it: its type or its size. */
export function photoFileProblem(file: {
  type: string;
  size: number;
}): 'wrongType' | 'tooLarge' | null {
  if (!PHOTO_TYPES.includes(file.type)) return 'wrongType';
  if (file.size > PHOTO_MAX_BYTES) return 'tooLarge';
  return null;
}

/** A quarter turn clockwise (1) or counter-clockwise (-1). */
export function turned(
  rotation: PhotoRotation,
  direction: 1 | -1,
): PhotoRotation {
  return ((rotation + 90 * direction + 360) % 360) as PhotoRotation;
}

/**
 * The crop to send: the cropper's square in pixels of the turned picture (`imagePosition`) as
 * fractions of that picture (`size`), kept inside 0–1.
 */
export function cropFromImagePosition(
  position: Corners,
  size: Size,
  rotation: PhotoRotation,
): PhotoCrop {
  const fraction = (value: number, of: number) =>
    Math.round(Math.min(1, Math.max(0, value / of)) * 1e6) / 1e6;
  const x = fraction(position.x1, size.width);
  const y = fraction(position.y1, size.height);
  return {
    x,
    y,
    width: Math.min(1 - x, fraction(position.x2 - position.x1, size.width)),
    height: Math.min(1 - y, fraction(position.y2 - position.y1, size.height)),
    rotation,
  };
}

/** Where to draw a saved crop on the picture as the cropper shows it (`shown`, in pixels). */
export function cornersFromCrop(crop: PhotoCrop, shown: Size): Corners {
  return {
    x1: crop.x * shown.width,
    y1: crop.y * shown.height,
    x2: (crop.x + crop.width) * shown.width,
    y2: (crop.y + crop.height) * shown.height,
  };
}
