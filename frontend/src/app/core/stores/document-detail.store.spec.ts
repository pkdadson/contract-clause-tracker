import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { DocumentsApi } from '../api/documents.api';
import { LabelsApi } from '../api/labels.api';
import type { DocumentDetail, Sentence } from '../types/api';
import { DocumentDetailStore } from './document-detail.store';

const sentence = (overrides: Partial<Sentence> = {}): Sentence => ({
  id: overrides.id ?? 's1',
  idx: overrides.idx ?? 0,
  text: overrides.text ?? 'Some sentence.',
  is_heading: overrides.is_heading ?? false,
  clause_type_id: overrides.clause_type_id ?? null,
});

const doc = (overrides: Partial<DocumentDetail> = {}): DocumentDetail => ({
  id: overrides.id ?? 'd1',
  title: overrides.title ?? 'Mutual NDA',
  party: overrides.party ?? 'Acme',
  contract_type: overrides.contract_type ?? 'NDA',
  uploaded_at: '2026-05-01T00:00:00',
  modified_at: '2026-05-10T00:00:00',
  sentences: overrides.sentences ?? [
    sentence({ id: 's1', idx: 0, is_heading: true, text: 'Heading' }),
    sentence({ id: 's2', idx: 1 }),
    sentence({ id: 's3', idx: 2, clause_type_id: 'liability' }),
  ],
});

interface DocsApiMock {
  get: jasmine.Spy<(id: string) => Observable<DocumentDetail>>;
}
interface LabelsApiMock {
  set: jasmine.Spy<(d: string, s: string, c: string) => Observable<Sentence>>;
  clear: jasmine.Spy<(d: string, s: string) => Observable<Sentence>>;
}

const setup = () => {
  const docsApi: DocsApiMock = { get: jasmine.createSpy('get') };
  const labelsApi: LabelsApiMock = {
    set: jasmine.createSpy('set'),
    clear: jasmine.createSpy('clear'),
  };
  TestBed.configureTestingModule({
    providers: [
      DocumentDetailStore,
      { provide: DocumentsApi, useValue: docsApi },
      { provide: LabelsApi, useValue: labelsApi },
    ],
  });
  return { store: TestBed.inject(DocumentDetailStore), docsApi, labelsApi };
};

describe('DocumentDetailStore', () => {
  describe('load', () => {
    it('sets the document and clears loading on success', () => {
      const { store, docsApi } = setup();
      docsApi.get.and.returnValue(of(doc()));
      store.load('d1');
      expect(store.document()?.id).toBe('d1');
      expect(store.loading()).toBeFalse();
      expect(store.error()).toBeNull();
      expect(store.notFound()).toBeFalse();
    });

    it('flips notFound on a 404 response', () => {
      const { store, docsApi } = setup();
      docsApi.get.and.returnValue(throwError(() => ({ status: 404 })));
      store.load('missing');
      expect(store.notFound()).toBeTrue();
      expect(store.error()).toBeNull();
      expect(store.loading()).toBeFalse();
    });

    it('sets a user-facing error message on a non-404 failure', () => {
      const { store, docsApi } = setup();
      docsApi.get.and.returnValue(throwError(() => ({ status: 500 })));
      store.load('d1');
      expect(store.notFound()).toBeFalse();
      expect(store.error()).toBe('Could not load this contract');
    });
  });

  describe('computed counts', () => {
    it('excludes headings from sentence and labelled counts', () => {
      const { store, docsApi } = setup();
      docsApi.get.and.returnValue(of(doc()));
      store.load('d1');
      expect(store.sentenceCount()).toBe(2);
      expect(store.labeledCount()).toBe(1);
    });

    it('returns zero counts when no document is loaded', () => {
      const { store } = setup();
      expect(store.sentenceCount()).toBe(0);
      expect(store.labeledCount()).toBe(0);
    });
  });

  describe('setLabel — optimistic with rollback', () => {
    it('patches the sentence immediately and calls the API', () => {
      const { store, docsApi, labelsApi } = setup();
      docsApi.get.and.returnValue(of(doc()));
      store.load('d1');
      labelsApi.set.and.returnValue(of(sentence({ id: 's2', clause_type_id: 'payment' })));

      const onError = jasmine.createSpy('onError');
      store.setLabel('s2', 'payment', onError);

      const s2 = store.document()!.sentences.find(s => s.id === 's2');
      expect(s2!.clause_type_id).toBe('payment');
      expect(labelsApi.set).toHaveBeenCalledWith('d1', 's2', 'payment');
      expect(onError).not.toHaveBeenCalled();
    });

    it('restores the previous label and calls onError when the API fails', () => {
      const { store, docsApi, labelsApi } = setup();
      docsApi.get.and.returnValue(of(doc()));
      store.load('d1');
      labelsApi.set.and.returnValue(throwError(() => new Error('boom')));

      const onError = jasmine.createSpy('onError');
      store.setLabel('s3', 'payment', onError);

      const s3 = store.document()!.sentences.find(s => s.id === 's3');
      expect(s3!.clause_type_id).toBe('liability');
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when no document is loaded', () => {
      const { store, labelsApi } = setup();
      const onError = jasmine.createSpy('onError');
      store.setLabel('s1', 'payment', onError);
      expect(labelsApi.set).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('clearLabel — optimistic with rollback', () => {
    it('clears the sentence label immediately and calls the API', () => {
      const { store, docsApi, labelsApi } = setup();
      docsApi.get.and.returnValue(of(doc()));
      store.load('d1');
      labelsApi.clear.and.returnValue(of(sentence({ id: 's3', clause_type_id: null })));

      const onError = jasmine.createSpy('onError');
      store.clearLabel('s3', onError);

      const s3 = store.document()!.sentences.find(s => s.id === 's3');
      expect(s3!.clause_type_id).toBeNull();
      expect(labelsApi.clear).toHaveBeenCalledWith('d1', 's3');
      expect(onError).not.toHaveBeenCalled();
    });

    it('restores the previous label when the API fails', () => {
      const { store, docsApi, labelsApi } = setup();
      docsApi.get.and.returnValue(of(doc()));
      store.load('d1');
      labelsApi.clear.and.returnValue(throwError(() => new Error('boom')));

      const onError = jasmine.createSpy('onError');
      store.clearLabel('s3', onError);

      const s3 = store.document()!.sentences.find(s => s.id === 's3');
      expect(s3!.clause_type_id).toBe('liability');
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });
});
