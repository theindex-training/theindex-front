import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Media, MediaService, mediaThumbnail } from './media.service';

const media = (variantWidths: number[]): Media => ({
  id: 'm1',
  altText: 'Щанга',
  width: 3000,
  height: 2000,
  url: 'https://media.test/m1/master.jpg',
  variants: variantWidths.map((width) => ({
    url: `https://media.test/m1/${width}.webp`,
    width,
    height: Math.round((width * 2) / 3),
  })),
  ogImage: { url: 'https://media.test/m1/og.jpg', width: 1200, height: 630 },
  originalFilename: 'IMG_1.jpg',
  sizeBytes: 1000,
  uploadedByAccountId: null,
  createdAt: '2026-11-06T10:00:00Z',
  updatedAt: '2026-11-06T10:00:00Z',
});

describe('MediaService', () => {
  let service: MediaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MediaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists a page of the library and gets one image', () => {
    service.list().subscribe();
    service.list(3, 10).subscribe();
    service.getById('m1').subscribe();

    expect(
      http
        .match(() => true)
        .map((req) => [req.request.method, req.request.urlWithParams]),
    ).toEqual([
      ['GET', '/api/media?page=1'],
      ['GET', '/api/media?page=3&pageSize=10'],
      ['GET', '/api/media/m1'],
    ]);
  });

  it('uploads the file and the alt text as multipart form data', () => {
    const file = new File(['png'], 'bar.png', { type: 'image/png' });
    service.upload(file, 'Атлет с щанга').subscribe();

    const req = http.expectOne('/api/media');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('bar.png');
    expect(body.get('altText')).toBe('Атлет с щанга');
    req.flush(media([480]));
  });

  it('picks the narrowest variant at least as wide as asked, else the widest, else the master', () => {
    expect(mediaThumbnail(media([480, 960, 1600]), 600)).toBe(
      'https://media.test/m1/960.webp',
    );
    expect(mediaThumbnail(media([480, 960]), 2000)).toBe(
      'https://media.test/m1/960.webp',
    );
    expect(mediaThumbnail(media([]))).toBe('https://media.test/m1/master.jpg');
  });
});
