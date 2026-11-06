import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ArticleCategoriesService } from './article-categories.service';

describe('ArticleCategoriesService', () => {
  let service: ArticleCategoriesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ArticleCategoriesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists, gets, creates, updates and deletes under /api/article-categories', () => {
    service.list().subscribe();
    service.getById('c1').subscribe();
    service.create({ name: 'Хранене' }).subscribe();
    service.update('c1', { slug: 'hrana', description: null }).subscribe();
    service.delete('c1').subscribe();

    expect(
      http
        .match(() => true)
        .map((req) => [
          req.request.method,
          req.request.urlWithParams,
          req.request.body,
        ]),
    ).toEqual([
      ['GET', '/api/article-categories', null],
      ['GET', '/api/article-categories/c1', null],
      ['POST', '/api/article-categories', { name: 'Хранене' }],
      [
        'PATCH',
        '/api/article-categories/c1',
        { slug: 'hrana', description: null },
      ],
      ['DELETE', '/api/article-categories/c1', null],
    ]);
  });
});
