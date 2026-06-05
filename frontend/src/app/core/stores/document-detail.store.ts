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

  readonly document = signal<DocumentDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);

  readonly bodySentences = computed(() =>
    (this.document()?.sentences ?? []).filter(s => !s.is_heading),
  );
  readonly labeledCount = computed(
    () => this.bodySentences().filter(s => !!s.clause_type_id).length,
  );
  readonly sentenceCount = computed(() => this.bodySentences().length);

  load(id: string): void {
    this.cancelLoad$.next();
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.docsApi
      .get(id)
      .pipe(takeUntil(this.cancelLoad$))
      .subscribe({
        next: d => {
          this.document.set(d);
          this.loading.set(false);
        },
        error: e => {
          this.loading.set(false);
          if (e?.status === 404) this.notFound.set(true);
          else this.error.set('Could not load this contract');
        },
      });
  }

  setLabel(sentenceId: string, clauseTypeId: string, onError: () => void): void {
    const doc = this.document();
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
    const doc = this.document();
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
      : doc.sentences.find(s => s.id === sentenceId)?.clause_type_id ?? null;
    const next: LabelInflight = { original, cancel: new Subject<void>() };
    this.labelInflight.set(sentenceId, next);
    return next;
  }

  private _patchSentence(sid: string, patch: Partial<Sentence>): void {
    this.document.update(doc => {
      if (!doc) return doc;
      return {
        ...doc,
        sentences: doc.sentences.map(s => (s.id === sid ? { ...s, ...patch } : s)),
      };
    });
  }
}
