import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

/**
 * A category of articles on the public site (theindex-api `article-categories`, ADMIN only).
 * Its public page is /articles/category/<slug>; `sortOrder` orders the site's menu, lowest first.
 */
export interface ArticleCategory {
  id: string;
  language: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Without `slug` the API makes one from the name; without `sortOrder` it goes last. */
export interface CreateArticleCategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
}

/**
 * Every field is optional. Renaming keeps the slug; the API refuses (409) a new slug while a
 * published article uses the category. `null` removes the description.
 */
export interface UpdateArticleCategoryPayload {
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ArticleCategoriesService {
  private readonly baseUrl = `${environment.apiUrl}/article-categories`;

  constructor(private readonly http: HttpClient) {}

  /** All categories, in menu order. */
  list(): Observable<ArticleCategory[]> {
    return this.http.get<ArticleCategory[]>(this.baseUrl);
  }

  getById(id: string): Observable<ArticleCategory> {
    return this.http.get<ArticleCategory>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateArticleCategoryPayload): Observable<ArticleCategory> {
    return this.http.post<ArticleCategory>(this.baseUrl, payload);
  }

  update(
    id: string,
    payload: UpdateArticleCategoryPayload,
  ): Observable<ArticleCategory> {
    return this.http.patch<ArticleCategory>(`${this.baseUrl}/${id}`, payload);
  }

  /** Permanent. The articles stay; they lose the category. */
  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
