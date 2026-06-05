import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { DocumentsApi } from '../api/documents.api';
import type { DocumentListItem } from '../types/api';
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
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly searchQuery = signal('');
  readonly clauseFilter = signal<ReadonlySet<string>>(new Set());
  readonly grouping = signal<GroupMode>('none');
  readonly sort = signal<SortMode>('modified-desc');

  readonly all = this._documents.asReadonly();
  readonly filtered = computed(() =>
    searchAndFilter(this._documents(), this.searchQuery(), this.clauseFilter()),
  );
  readonly sorted = computed(() => sortDocuments(this.filtered(), this.sort()));
  readonly grouped = computed(() => groupDocuments(this.sorted(), this.grouping()));

  load(): void {
    this.cancelLoad$.next();
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list()
      .pipe(takeUntil(this.cancelLoad$))
      .subscribe({
        next: docs => {
          this._documents.set(docs);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load contracts');
          this.loading.set(false);
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
}
