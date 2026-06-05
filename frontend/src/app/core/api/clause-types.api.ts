import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ClauseType } from '../types/api';

@Injectable({ providedIn: 'root' })
export class ClauseTypesApi {
  private http = inject(HttpClient);

  list(): Observable<ClauseType[]> {
    return this.http.get<ClauseType[]>(`${environment.apiBase}/clause-types`);
  }
}
