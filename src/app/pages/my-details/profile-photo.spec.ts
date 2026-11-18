import {
  PHOTO_MAX_BYTES,
  cornersFromCrop,
  cropFromImagePosition,
  photoFileProblem,
  turned,
} from './profile-photo';

describe('profile photo model', () => {
  it('accepts JPEG, PNG and WebP up to 15 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(photoFileProblem({ type, size: PHOTO_MAX_BYTES })).toBeNull();
    }
    expect(photoFileProblem({ type: 'image/heic', size: 10 })).toBe(
      'wrongType',
    );
    expect(photoFileProblem({ type: 'application/pdf', size: 10 })).toBe(
      'wrongType',
    );
    expect(
      photoFileProblem({ type: 'image/jpeg', size: PHOTO_MAX_BYTES + 1 }),
    ).toBe('tooLarge');
  });

  it('turns a quarter at a time, both ways', () => {
    expect(turned(0, 1)).toBe(90);
    expect(turned(270, 1)).toBe(0);
    expect(turned(0, -1)).toBe(270);
    expect(turned(180, -1)).toBe(90);
  });

  it('sends the square as fractions of the turned picture', () => {
    // A 1000×500 picture: a 400 px square, 250 px from the left, 50 from the top.
    expect(
      cropFromImagePosition(
        { x1: 250, y1: 50, x2: 650, y2: 450 },
        { width: 1000, height: 500 },
        90,
      ),
    ).toEqual({ x: 0.25, y: 0.1, width: 0.4, height: 0.8, rotation: 90 });
  });

  it('keeps the fractions inside the picture', () => {
    expect(
      cropFromImagePosition(
        { x1: -2, y1: 0, x2: 301, y2: 300 },
        { width: 300, height: 300 },
        0,
      ),
    ).toEqual({ x: 0, y: 0, width: 1, height: 1, rotation: 0 });
    const crop = cropFromImagePosition(
      { x1: 1, y1: 0, x2: 4, y2: 3 },
      { width: 3, height: 3 },
      0,
    );
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
  });

  it('draws a saved crop where it was, at the size the cropper shows the picture', () => {
    expect(
      cornersFromCrop(
        { x: 0.25, y: 0.1, width: 0.4, height: 0.8, rotation: 0 },
        { width: 500, height: 250 },
      ),
    ).toEqual({ x1: 125, y1: 25, x2: 325, y2: 225 });
  });
});
