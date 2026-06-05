import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { Sentence } from '../types/api';

@Injectable({ providedIn: 'root' })
export class LabelsApi {
  private http = inject(HttpClient);

  set(docId: string, sentenceId: string, clauseTypeId: string): Observable<Sentence> {
    return this.http.put<Sentence>(
      `${environment.apiBase}/documents/${docId}/sentences/${sentenceId}/label`,
      { clause_type_id: clauseTypeId },
    );
  }

  clear(docId: string, sentenceId: string): Observable<Sentence> {
    return this.http.delete<Sentence>(
      `${environment.apiBase}/documents/${docId}/sentences/${sentenceId}/label`,
    );
  }
}
