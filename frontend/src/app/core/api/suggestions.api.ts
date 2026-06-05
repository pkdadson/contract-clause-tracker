import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { Suggestion } from '../types/api';

@Injectable({ providedIn: 'root' })
export class SuggestionsApi {
  private http = inject(HttpClient);

  list(docId: string): Observable<Suggestion[]> {
    return this.http.get<Suggestion[]>(`${environment.apiBase}/documents/${docId}/suggestions`);
  }
}
