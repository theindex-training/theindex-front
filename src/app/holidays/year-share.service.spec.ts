import { TestBed } from '@angular/core/testing';
import { recordingContext } from '../../testing/canvas';
import { YearShareContent } from './year-share-image';
import { YearShareService } from './year-share.service';

const CONTENT: YearShareContent = {
  kicker: 'MY 2026 AT THE INDEX',
  figure: '96',
  figureLabel: 'trainings',
  rows: [],
  outro: 'See you at the gym in 2027.',
  site: 'theindex.training',
};

/** The browser's share API, as a phone has it (`canShare` true) or refusing with `error`. */
function stubShare(options: { can: boolean; error?: string }) {
  const share = vi.fn(() =>
    options.error
      ? Promise.reject(new DOMException('No', options.error))
      : Promise.resolve(),
  );
  Object.defineProperty(navigator, 'share', {
    value: share,
    configurable: true,
  });
  Object.defineProperty(navigator, 'canShare', {
    value: () => options.can,
    configurable: true,
  });
  return share;
}

describe('YearShareService', () => {
  let service: YearShareService;
  let downloads: string[];

  beforeEach(() => {
    service = TestBed.inject(YearShareService);
    downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => 'blob:picture',
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: () => undefined,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (navigator as unknown as Record<string, unknown>)['share'];
    delete (navigator as unknown as Record<string, unknown>)['canShare'];
  });

  const file = () =>
    new File(['png'], 'the-index-2026.png', { type: 'image/png' });

  it('opens the share sheet with the picture where the browser shares files', async () => {
    const share = stubShare({ can: true });
    const picture = file();
    await expect(
      service.shareOrSave(picture, 'My 2026', 'My 2026: 96 trainings.'),
    ).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      files: [picture],
      title: 'My 2026',
      text: 'My 2026: 96 trainings.',
    });
    expect(downloads).toEqual([]);
  });

  it('saves nothing when the person closes the share sheet', async () => {
    stubShare({ can: true, error: 'AbortError' });
    await expect(service.shareOrSave(file(), 't', 't')).resolves.toBe(
      'cancelled',
    );
    expect(downloads).toEqual([]);
  });

  it('downloads the picture where the browser can’t share it', async () => {
    stubShare({ can: false });
    await expect(service.shareOrSave(file(), 't', 't')).resolves.toBe('saved');
    expect(downloads).toEqual(['the-index-2026.png']);

    // Nor when a share is refused (e.g. the tap's activation ran out).
    stubShare({ can: true, error: 'NotAllowedError' });
    await expect(service.shareOrSave(file(), 't', 't')).resolves.toBe('saved');
    expect(downloads).toEqual(['the-index-2026.png', 'the-index-2026.png']);
  });

  it('makes a PNG file of the drawn picture, without a logo it can’t load', async () => {
    const { context, drawn } = recordingContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback) => callback(new Blob(['png'], { type: 'image/png' })),
    );
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));

    const picture = await service.makeImage(CONTENT, 'the-index-2026.png');
    expect(picture.name).toBe('the-index-2026.png');
    expect(picture.type).toBe('image/png');
    expect(drawn.map((item) => item.text)).toContain('96');
  });

  it('fails when the browser can’t draw', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(service.makeImage(CONTENT, 'x.png')).rejects.toThrow();
  });
});
