import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ContractType, DocumentDetail, DocumentListItem } from '../types/api';

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private http = inject(HttpClient);

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
    return this.http.patch<DocumentDetail>(
      `${environment.apiBase}/documents/${id}`,
      { contract_type: contractType },
    );
  }
}
