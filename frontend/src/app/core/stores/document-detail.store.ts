import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { DocumentsApi } from '../api/documents.api';
import { LabelsApi } from '../api/labels.api';
import type { DocumentDetail, Sentence } from '../types/api';

interface LabelInflight {
  /** The pre-optimistic label, captured before *any* in-flight call mutated it. */
  original: string | null;
  cancel: Subject<void>;
}

@Injectable({ providedIn: 'root' })
export class DocumentDetailStore {
  private docsApi = inject(DocumentsApi);
  private labelsApi = inject(LabelsApi);

  private cancelLoad$ = new Subject<void>();
  private labelInflight = new Map<string, LabelInflight>();

  private readonly _document = signal<DocumentDetail | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _notFound = signal(false);

  readonly document = this._document.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly notFound = this._notFound.asReadonly();

  readonly bodySentences = computed(() =>
    (this._document()?.sentences ?? []).filter(s => !s.is_heading),
  );
  readonly labeledCount = computed(
    () => this.bodySentences().filter(s => !!s.clause_type_id).length,
  );
  readonly sentenceCount = computed(() => this.bodySentences().length);

  upsert(doc: DocumentDetail): void {
    this.cancelLoad$.next();
    this._document.set(doc);
    this._loading.set(false);
    this._error.set(null);
    this._notFound.set(false);
  }

  load(id: string): void {
    if (this._document()?.id === id) return;
    this.cancelLoad$.next();
    this._loading.set(true);
    this._error.set(null);
    this._notFound.set(false);
    this.docsApi
      .get(id)
      .pipe(takeUntil(this.cancelLoad$))
      .subscribe({
        next: d => {
          this._document.set(d);
          this._loading.set(false);
        },
        error: e => {
          this._loading.set(false);
          if (e?.status === 404) this._notFound.set(true);
          else this._error.set('Could not load this contract');
        },
      });
  }

  setLabel(sentenceId: string, clauseTypeId: string, onError: () => void): void {
    const doc = this._document();
    if (!doc) return;
    const inflight = this.beginInflight(sentenceId, doc);
    this._patchSentence(sentenceId, { clause_type_id: clauseTypeId });
    this.labelsApi
      .set(doc.id, sentenceId, clauseTypeId)
      .pipe(takeUntil(inflight.cancel))
      .subscribe({
        next: () => this.labelInflight.delete(sentenceId),
        error: () => {
          this.labelInflight.delete(sentenceId);
          this._patchSentence(sentenceId, { clause_type_id: inflight.original });
          onError();
        },
      });
  }

  clearLabel(sentenceId: string, onError: () => void): void {
    const doc = this._document();
    if (!doc) return;
    const inflight = this.beginInflight(sentenceId, doc);
    this._patchSentence(sentenceId, { clause_type_id: null });
    this.labelsApi
      .clear(doc.id, sentenceId)
      .pipe(takeUntil(inflight.cancel))
      .subscribe({
        next: () => this.labelInflight.delete(sentenceId),
        error: () => {
          this.labelInflight.delete(sentenceId);
          this._patchSentence(sentenceId, { clause_type_id: inflight.original });
          onError();
        },
      });
  }

  private beginInflight(sentenceId: string, doc: DocumentDetail): LabelInflight {
    const existing = this.labelInflight.get(sentenceId);
    if (existing) {
      existing.cancel.next();
      existing.cancel.complete();
    }
    const original = existing
      ? existing.original
      : (doc.sentences.find(s => s.id === sentenceId)?.clause_type_id ?? null);
    const next: LabelInflight = { original, cancel: new Subject<void>() };
    this.labelInflight.set(sentenceId, next);
    return next;
  }

  private _patchSentence(sid: string, patch: Partial<Sentence>): void {
    this._document.update(doc => {
      if (!doc) return doc;
      return {
        ...doc,
        sentences: doc.sentences.map(s => (s.id === sid ? { ...s, ...patch } : s)),
      };
    });
  }
}
