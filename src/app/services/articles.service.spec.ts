import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ArticlesService } from './articles.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ArticlesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const sent = () =>
    http
      .match(() => true)
      .map((req) => [
        req.request.method,
        req.request.urlWithParams,
        req.request.body,
      ]);

  it('lists with only the query values that are set', () => {
    service.list().subscribe();
    service
      .list({ status: 'PUBLISHED', search: 'клек', page: 2, pageSize: 20 })
      .subscribe();
    service.list({ status: undefined, search: '' }).subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/articles', null],
      [
        'GET',
        '/api/articles?status=PUBLISHED&search=%D0%BA%D0%BB%D0%B5%D0%BA&page=2&pageSize=20',
        null,
      ],
      ['GET', '/api/articles', null],
    ]);
  });

  it('gets one, creates a draft from a title and autosaves to /draft', () => {
    service.getById('a1').subscribe();
    service.create('Как да започнем').subscribe();
    service
      .saveDraft('a1', { baseRevision: 3, title: 'Ново', excerpt: null })
      .subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/articles/a1', null],
      ['POST', '/api/articles', { title: 'Как да започнем' }],
      [
        'PATCH',
        '/api/articles/a1/draft',
        { baseRevision: 3, title: 'Ново', excerpt: null },
      ],
    ]);
  });

  it('publishes, unpublishes, discards, deletes and asks for a preview token', () => {
    service.publish('a1', 4).subscribe();
    service.unpublish('a1').subscribe();
    service.discardDraft('a1', 5).subscribe();
    service.delete('a1').subscribe();
    service.createPreviewToken('a1').subscribe();

    expect(sent()).toEqual([
      ['POST', '/api/articles/a1/publish', { baseRevision: 4 }],
      ['POST', '/api/articles/a1/unpublish', {}],
      ['POST', '/api/articles/a1/discard-draft', { baseRevision: 5 }],
      ['DELETE', '/api/articles/a1', null],
      ['POST', '/api/articles/a1/preview-token', {}],
    ]);
  });
});
