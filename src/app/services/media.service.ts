import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

export interface MediaFile {
  url: string;
  width: number;
  height: number;
}

/** An image of the media library (theindex-api `media`, ADMIN only). URLs are absolute. */
export interface Media {
  id: string;
  altText: string;
  width: number;
  height: number;
  /** The master: full size, upright, metadata removed. */
  url: string;
  /** WebP versions, narrowest first. */
  variants: MediaFile[];
  /** 1200×630 crop for social previews. */
  ogImage: MediaFile;
  originalFilename: string | null;
  sizeBytes: number;
  uploadedByAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaPage {
  items: Media[];
  total: number;
  page: number;
  pageSize: number;
}

/** The narrowest file that is at least `minWidth` wide (a variant, else the master). */
export function mediaThumbnail(media: Media, minWidth = 480): string {
  return (
    media.variants.find((variant) => variant.width >= minWidth)?.url ??
    media.variants.at(-1)?.url ??
    media.url
  );
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly baseUrl = `${environment.apiUrl}/media`;

  constructor(private readonly http: HttpClient) {}

  /** Newest first; 24 per page by default, up to 50. */
  list(page = 1, pageSize?: number): Observable<MediaPage> {
    return this.http.get<MediaPage>(this.baseUrl, {
      params: buildHttpParams({ page, pageSize }),
    });
  }

  getById(id: string): Observable<Media> {
    return this.http.get<Media>(`${this.baseUrl}/${id}`);
  }

  /**
   * Multipart upload: JPEG, PNG or WebP (the API checks by decoding, and answers 413 above its
   * size limit). The alt text is required, 1–250 characters.
   */
  upload(file: File, altText: string): Observable<Media> {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('altText', altText);
    return this.http.post<Media>(this.baseUrl, body);
  }
}
