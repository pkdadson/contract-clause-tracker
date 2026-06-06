import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { DocumentsApi } from '../api/documents.api';
import { LabelsApi } from '../api/labels.api';
import type { DocumentDetail, IngestEvent, Sentence } from '../types/api';
import { DocumentDetailStore } from './document-detail.store';

const sentence = (overrides: Partial<Sentence> = {}): Sentence => ({
  id: overrides.id ?? 's1',
  idx: overrides.idx ?? 0,
  paragraph_idx: overrides.paragraph_idx ?? overrides.idx ?? 0,
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
  progressStream: jasmine.Spy<(id: string) => Observable<IngestEvent>>;
}
interface LabelsApiMock {
  set: jasmine.Spy<(d: string, s: string, c: string) => Observable<Sentence>>;
  clear: jasmine.Spy<(d: string, s: string) => Observable<Sentence>>;
}

const setup = () => {
  const docsApi: DocsApiMock = {
    get: jasmine.createSpy('get'),
    progressStream: jasmine.createSpy('progressStream'),
  };
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

  describe('setLabel — rapid concurrent calls on the same sentence', () => {
    it('rolling back the second call restores the ORIGINAL label, not the optimistic intermediate', () => {
      const { store, docsApi, labelsApi } = setup();
      docsApi.get.and.returnValue(of(doc()));
      store.load('d1');

      const first = new Subject<Sentence>();
      const second = new Subject<Sentence>();
      labelsApi.set.and.returnValues(first.asObservable(), second.asObservable());

      const onError1 = jasmine.createSpy('onError1');
      const onError2 = jasmine.createSpy('onError2');

      store.setLabel('s3', 'payment', onError1);
      expect(store.document()!.sentences.find(s => s.id === 's3')!.clause_type_id).toBe('payment');

      store.setLabel('s3', 'indemnity', onError2);
      expect(store.document()!.sentences.find(s => s.id === 's3')!.clause_type_id).toBe(
        'indemnity',
      );

      second.error(new Error('boom'));
      expect(store.document()!.sentences.find(s => s.id === 's3')!.clause_type_id).toBe(
        'liability',
      );
      expect(onError2).toHaveBeenCalledTimes(1);

      first.next(sentence({ id: 's3', clause_type_id: 'payment' }));
      expect(store.document()!.sentences.find(s => s.id === 's3')!.clause_type_id).toBe(
        'liability',
      );
      expect(onError1).not.toHaveBeenCalled();
    });

    it('clears the in-flight record when the call succeeds so the next call captures fresh state', () => {
      const { store, docsApi, labelsApi } = setup();
      docsApi.get.and.returnValue(of(doc()));
      store.load('d1');

      const first = new Subject<Sentence>();
      const second = new Subject<Sentence>();
      labelsApi.set.and.returnValues(first.asObservable(), second.asObservable());

      store.setLabel('s3', 'payment', () => {});
      first.next(sentence({ id: 's3', clause_type_id: 'payment' }));

      const onError = jasmine.createSpy('onError');
      store.setLabel('s3', 'indemnity', onError);
      second.error(new Error('boom'));

      expect(store.document()!.sentences.find(s => s.id === 's3')!.clause_type_id).toBe('payment');
      expect(onError).toHaveBeenCalledTimes(1);
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

  describe('upsert — prime from a known source (e.g. the upload response)', () => {
    it('sets the document and clears loading without hitting the API', () => {
      const { store, docsApi } = setup();
      store.upsert(doc({ id: 'primed' }));
      expect(store.document()?.id).toBe('primed');
      expect(store.loading()).toBeFalse();
      expect(docsApi.get).not.toHaveBeenCalled();
    });

    it('makes a subsequent load(sameId) a no-op so the viewer renders instantly', () => {
      const { store, docsApi } = setup();
      store.upsert(doc({ id: 'primed' }));
      store.load('primed');
      expect(docsApi.get).not.toHaveBeenCalled();
      expect(store.loading()).toBeFalse();
      expect(store.document()?.id).toBe('primed');
    });

    it('does NOT short-circuit when load() is called with a different id', () => {
      const { store, docsApi } = setup();
      store.upsert(doc({ id: 'primed' }));
      docsApi.get.and.returnValue(of(doc({ id: 'other' })));
      store.load('other');
      expect(docsApi.get).toHaveBeenCalledWith('other');
      expect(store.document()?.id).toBe('other');
    });
  });

  describe('rapid load cancels the prior in-flight request', () => {
    it('drops a stale document response when a second load arrives before it resolves', () => {
      const { store, docsApi } = setup();
      const first = new Subject<DocumentDetail>();
      const second = new Subject<DocumentDetail>();
      docsApi.get.and.returnValues(first.asObservable(), second.asObservable());

      store.load('A');
      store.load('B');

      first.next(doc({ id: 'A' }));
      expect(store.document()).toBeNull();

      second.next(doc({ id: 'B' }));
      expect(store.document()?.id).toBe('B');
    });
  });

  describe('streamProgress', () => {
    it('flips streaming() to true and false as events arrive and complete', () => {
      const { store, docsApi } = setup();
      store.upsert(doc({ id: 'd1', sentences: [] }));

      const events = new Subject<IngestEvent>();
      docsApi.progressStream.and.returnValue(events.asObservable());

      store.streamProgress('d1');
      expect(store.streaming()).toBeTrue();

      events.next({ phase: 'done', total: 0 });
      events.complete();
      expect(store.streaming()).toBeFalse();
    });

    it('appends streamed sentences into the current document', () => {
      const { store, docsApi } = setup();
      store.upsert(doc({ id: 'd1', sentences: [] }));

      const events = new Subject<IngestEvent>();
      docsApi.progressStream.and.returnValue(events.asObservable());

      store.streamProgress('d1');
      events.next({
        phase: 'sentences',
        items: [
          sentence({ id: 'n1', idx: 0, text: 'One.' }),
          sentence({ id: 'n2', idx: 1, text: 'Two.' }),
        ],
      });

      expect(store.document()!.sentences.length).toBe(2);
      expect(store.document()!.sentences.map(s => s.text)).toEqual(['One.', 'Two.']);
    });

    it('is a no-op when already streaming the same document', () => {
      const { store, docsApi } = setup();
      store.upsert(doc({ id: 'd1', sentences: [] }));
      const events = new Subject<IngestEvent>();
      docsApi.progressStream.and.returnValue(events.asObservable());

      store.streamProgress('d1');
      store.streamProgress('d1');

      expect(docsApi.progressStream).toHaveBeenCalledTimes(1);
    });

    it('tears down a prior subscription when called with a different id', () => {
      const { store, docsApi } = setup();
      store.upsert(doc({ id: 'd1', sentences: [] }));

      const firstStream = new Subject<IngestEvent>();
      const secondStream = new Subject<IngestEvent>();
      docsApi.progressStream.and.returnValues(
        firstStream.asObservable(),
        secondStream.asObservable(),
      );

      store.streamProgress('d1');
      expect(firstStream.observed).toBeTrue();

      store.upsert(doc({ id: 'd2', sentences: [] }));
      store.streamProgress('d2');
      expect(firstStream.observed).toBeFalse();
    });

    it('flips streaming() false and surfaces an error message on error event', () => {
      const { store, docsApi } = setup();
      store.upsert(doc({ id: 'd1', sentences: [] }));

      const events = new Subject<IngestEvent>();
      docsApi.progressStream.and.returnValue(events.asObservable());

      store.streamProgress('d1');
      events.error(new Error('boom'));

      expect(store.streaming()).toBeFalse();
      expect(store.error()).toBe('Lost connection while saving sentences. Refresh to see what was saved.');
    });
  });
});
