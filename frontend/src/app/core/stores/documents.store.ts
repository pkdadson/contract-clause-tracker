import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { DocumentsApi } from '../api/documents.api';
import type { ContractType, DocumentListItem } from '../types/api';
import {
  groupDocuments,
  searchAndFilter,
  sortDocuments,
  type GroupMode,
  type SortMode,
} from '../../features/dashboard/utils/derivations';

@Injectable({ providedIn: 'root' })
export class DocumentsStore {
  private api = inject(DocumentsApi);
  private cancelLoad$ = new Subject<void>();

  private readonly _documents = signal<DocumentListItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly searchQuery = signal('');
  readonly clauseFilter = signal<ReadonlySet<string>>(new Set());
  readonly grouping = signal<GroupMode>('none');
  readonly sort = signal<SortMode>('modified-desc');

  readonly all = this._documents.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filtered = computed(() =>
    searchAndFilter(this._documents(), this.searchQuery(), this.clauseFilter()),
  );
  readonly sorted = computed(() => sortDocuments(this.filtered(), this.sort()));
  readonly grouped = computed(() => groupDocuments(this.sorted(), this.grouping()));

  load(): void {
    this.cancelLoad$.next();
    this._loading.set(true);
    this._error.set(null);
    this.api
      .list()
      .pipe(takeUntil(this.cancelLoad$))
      .subscribe({
        next: docs => {
          this._documents.set(docs);
          this._loading.set(false);
        },
        error: () => {
          this._error.set('Could not load contracts');
          this._loading.set(false);
        },
      });
  }

  upsert(doc: DocumentListItem): void {
    this._documents.update(list => {
      const i = list.findIndex(d => d.id === doc.id);
      if (i === -1) return [doc, ...list];
      const copy = [...list];
      copy[i] = doc;
      return copy;
    });
  }

  setContractType(documentId: string, value: ContractType | null): void {
    const list = this._documents();
    const idx = list.findIndex(d => d.id === documentId);
    if (idx === -1) return;
    const previous = list[idx]!;
    const optimistic: DocumentListItem = { ...previous, contract_type: value };
    this._documents.update(curr => {
      const copy = [...curr];
      copy[idx] = optimistic;
      return copy;
    });
    this.api.update(documentId, value).subscribe({
      error: () => {
        this._documents.update(curr => {
          const copy = [...curr];
          const i = copy.findIndex(d => d.id === documentId);
          if (i !== -1) copy[i] = previous;
          return copy;
        });
        this._error.set('Could not update contract type');
      },
    });
  }
}
