import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

/** theindex-api `ArticleStatus`: DRAFT (never published), PUBLISHED, UNPUBLISHED (taken down). */
export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';

export interface ArticleListItem {
  content: string;
  items: ArticleListItem[];
}

/**
 * A block as theindex-api stores it (articles/article-content.ts): Editor.js output, normalized.
 * Images and YouTube videos are references (`mediaId`, `videoId`), never URLs.
 */
export type ArticleBlock =
  | { id?: string; type: 'paragraph'; data: { text: string } }
  | { id?: string; type: 'header'; data: { text: string; level: 2 | 3 } }
  | {
      id?: string;
      type: 'list';
      data: { style: 'ordered' | 'unordered'; items: ArticleListItem[] };
    }
  | { id?: string; type: 'quote'; data: { text: string; caption: string } }
  | { id?: string; type: 'image'; data: { mediaId: string; caption: string } }
  | {
      id?: string;
      type: 'embed';
      data: { service: 'youtube'; videoId: string; caption: string };
    }
  | { id?: string; type: 'delimiter'; data: Record<string, never> };

export interface ArticleContent {
  time?: number;
  version?: string;
  blocks: ArticleBlock[];
}

/** The working copy that autosave writes to. The public site never sees it. */
export interface ArticleDraft {
  title: string;
  excerpt: string | null;
  content: ArticleContent;
  featuredMediaId: string | null;
  categoryIds: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  /** A slug the admin chose (before the first publish only); null: made from the title. */
  slug: string | null;
}

/** What is live on the site; null before the first publish. */
export interface PublishedArticleVersion {
  title: string | null;
  excerpt: string | null;
  content: ArticleContent | null;
  featuredMediaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  categoryIds: string[];
}

/** `GET /api/articles/:id`: the published version and the draft. */
export interface Article {
  id: string;
  language: string;
  status: ArticleStatus;
  /** Set at the first publish, then fixed. */
  slug: string | null;
  published: PublishedArticleVersion | null;
  draft: ArticleDraft;
  /** +1 on every draft save; a save based on an older one gets a 409. */
  draftRevision: number;
  draftUpdatedAt: string;
  hasUnpublishedChanges: boolean;
  firstPublishedAt: string | null;
  lastPublishedAt: string | null;
  unpublishedAt: string | null;
  createdByAccountId: string | null;
  updatedByAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row of `GET /api/articles`. `title` is the draft's title. */
export interface ArticleSummary {
  id: string;
  status: ArticleStatus;
  slug: string | null;
  title: string;
  publishedTitle: string | null;
  categoryIds: string[];
  featuredMediaId: string | null;
  hasUnpublishedChanges: boolean;
  draftUpdatedAt: string;
  firstPublishedAt: string | null;
  lastPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticlePage {
  items: ArticleSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ArticleListQuery {
  status?: ArticleStatus;
  categoryId?: string;
  /** Part of the draft title, ignoring case (up to 100 characters). */
  search?: string;
  page?: number;
  /** 20 by default, up to 50. */
  pageSize?: number;
}

/**
 * Autosave: only the fields that changed. `null` clears an optional field; `slug` may only be sent
 * before the first publish.
 */
export interface SaveDraftChanges {
  title?: string;
  excerpt?: string | null;
  content?: ArticleContent;
  featuredMediaId?: string | null;
  categoryIds?: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  slug?: string | null;
}

export interface SaveDraftPayload extends SaveDraftChanges {
  /** The draftRevision the page last loaded or saved. */
  baseRevision: number;
}

/** The 409 body of a stale save: someone saved a newer revision meanwhile. */
export interface StaleRevisionError {
  message: string;
  currentRevision: number;
}

/** Articles of the public site in the back office (theindex-api `articles`, ADMIN only). */
@Injectable({
  providedIn: 'root',
})
export class ArticlesService {
  private readonly baseUrl = `${environment.apiUrl}/articles`;

  constructor(private readonly http: HttpClient) {}

  /** Most recently changed first. */
  list(query: ArticleListQuery = {}): Observable<ArticlePage> {
    return this.http.get<ArticlePage>(this.baseUrl, {
      params: buildHttpParams({ ...query }),
    });
  }

  getById(id: string): Observable<Article> {
    return this.http.get<Article>(`${this.baseUrl}/${id}`);
  }

  /** A new draft with only a title; the slug comes at the first publish. */
  create(title: string): Observable<Article> {
    return this.http.post<Article>(this.baseUrl, { title });
  }

  /** Autosave. 409 when `baseRevision` is no longer the current one. */
  saveDraft(id: string, payload: SaveDraftPayload): Observable<Article> {
    return this.http.patch<Article>(`${this.baseUrl}/${id}/draft`, payload);
  }
}
