import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ContractType, DocumentDetail, DocumentListItem, IngestEvent } from '../types/api';

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private http = inject(HttpClient);
  private zone = inject(NgZone);

  list(): Observable<DocumentListItem[]> {
    return this.http.get<DocumentListItem[]>(`${environment.apiBase}/documents`);
  }

  get(id: string): Observable<DocumentDetail> {
    return this.http.get<DocumentDetail>(`${environment.apiBase}/documents/${id}`);
  }

  upload(file: File): Observable<DocumentDetail> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<DocumentDetail>(`${environment.apiBase}/documents`, form);
  }

  update(id: string, contractType: ContractType | null): Observable<DocumentDetail> {
    return this.http.patch<DocumentDetail>(`${environment.apiBase}/documents/${id}`, {
      contract_type: contractType,
    });
  }

  progressStream(documentId: string): Observable<IngestEvent> {
    return new Observable<IngestEvent>(subscriber => {
      const source = new EventSource(`${environment.apiBase}/documents/${documentId}/progress`);
      source.onmessage = e =>
        this.zone.run(() => {
          const event = JSON.parse(e.data) as IngestEvent;
          if (event.phase === 'error') {
            subscriber.error(new Error(event.message));
            source.close();
            return;
          }
          subscriber.next(event);
          if (event.phase === 'done') {
            subscriber.complete();
            source.close();
          }
        });
      source.onerror = () =>
        this.zone.run(() => {
          subscriber.error(new Error('Progress stream connection lost'));
          source.close();
        });
      return () => source.close();
    });
  }
}
