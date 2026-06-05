import { Injectable, computed, inject, signal } from '@angular/core';

import { DocumentsApi } from '../api/documents.api';
import { LabelsApi } from '../api/labels.api';
import type { DocumentDetail, Sentence } from '../types/api';

@Injectable({ providedIn: 'root' })
export class DocumentDetailStore {
  private docsApi = inject(DocumentsApi);
  private labelsApi = inject(LabelsApi);

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
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.docsApi.get(id).subscribe({
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
    const previous = doc.sentences.find(s => s.id === sentenceId)?.clause_type_id ?? null;
    this._patchSentence(sentenceId, { clause_type_id: clauseTypeId });
    this.labelsApi.set(doc.id, sentenceId, clauseTypeId).subscribe({
      error: () => {
        this._patchSentence(sentenceId, { clause_type_id: previous });
        onError();
      },
    });
  }

  clearLabel(sentenceId: string, onError: () => void): void {
    const doc = this.document();
    if (!doc) return;
    const previous = doc.sentences.find(s => s.id === sentenceId)?.clause_type_id ?? null;
    this._patchSentence(sentenceId, { clause_type_id: null });
    this.labelsApi.clear(doc.id, sentenceId).subscribe({
      error: () => {
        this._patchSentence(sentenceId, { clause_type_id: previous });
        onError();
      },
    });
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
