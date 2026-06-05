import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { DocumentsApi } from '../api/documents.api';
import type { DocumentListItem } from '../types/api';
import { DocumentsStore } from './documents.store';

const make = (overrides: Partial<DocumentListItem>): DocumentListItem => ({
  id: overrides.id ?? 'd1',
  title: overrides.title ?? 'Mutual NDA',
  party: overrides.party ?? 'Acme',
  contract_type: overrides.contract_type === undefined ? 'NDA' : overrides.contract_type,
  uploaded_at: '2026-05-01T00:00:00',
  modified_at: overrides.modified_at ?? '2026-05-10T00:00:00',
  sentence_count: overrides.sentence_count ?? 10,
  labeled_count: overrides.labeled_count ?? 0,
  clause_types_present: overrides.clause_types_present ?? [],
});

interface ApiMock {
  list: jasmine.Spy<() => Observable<DocumentListItem[]>>;
  update: jasmine.Spy<(id: string, ct: string | null) => Observable<unknown>>;
}

const setup = () => {
  const api: ApiMock = {
    list: jasmine.createSpy('list'),
    update: jasmine.createSpy('update'),
  };
  TestBed.configureTestingModule({
    providers: [DocumentsStore, { provide: DocumentsApi, useValue: api }],
  });
  return { store: TestBed.inject(DocumentsStore), api };
};

describe('DocumentsStore', () => {
  describe('load', () => {
    it('populates documents and clears loading on success', () => {
      const { store, api } = setup();
      const docs = [make({ id: '1' }), make({ id: '2' })];
      api.list.and.returnValue(of(docs));
      store.load();
      expect(store.all().map(d => d.id)).toEqual(['1', '2']);
      expect(store.loading()).toBeFalse();
      expect(store.error()).toBeNull();
    });

    it('sets a user-facing error message on failure', () => {
      const { store, api } = setup();
      api.list.and.returnValue(throwError(() => new Error('boom')));
      store.load();
      expect(store.error()).toBe('Could not load contracts');
      expect(store.loading()).toBeFalse();
    });
  });

  describe('reactive pipeline', () => {
    const docs = [
      make({
        id: '1',
        title: 'Northwind MSA',
        contract_type: 'MSA',
        clause_types_present: ['liability'],
        modified_at: '2026-05-01',
      }),
      make({
        id: '2',
        title: 'Helios NDA',
        contract_type: 'NDA',
        clause_types_present: ['confidential'],
        modified_at: '2026-05-10',
      }),
      make({
        id: '3',
        title: 'Apollo MSA',
        contract_type: 'MSA',
        clause_types_present: ['liability', 'payment'],
        modified_at: '2026-05-05',
      }),
    ];

    it('reflects search query changes downstream', () => {
      const { store, api } = setup();
      api.list.and.returnValue(of(docs));
      store.load();
      store.searchQuery.set('helios');
      expect(store.filtered().map(d => d.id)).toEqual(['2']);
      expect(store.sorted().map(d => d.id)).toEqual(['2']);
    });

    it('combines clause filter with sort and grouping', () => {
      const { store, api } = setup();
      api.list.and.returnValue(of(docs));
      store.load();
      store.clauseFilter.set(new Set(['liability']));
      store.sort.set('title-asc');
      store.grouping.set('contract-type');

      const groups = store.grouped();
      expect(groups.length).toBe(1);
      const [first] = groups;
      expect(first?.key).toBe('MSA');
      expect(first?.documents.map(d => d.id)).toEqual(['3', '1']);
    });

    it('sorts by modified date descending by default', () => {
      const { store, api } = setup();
      api.list.and.returnValue(of(docs));
      store.load();
      expect(store.sorted().map(d => d.id)).toEqual(['2', '3', '1']);
    });
  });

  describe('upsert', () => {
    it('inserts a new document at the head', () => {
      const { store, api } = setup();
      api.list.and.returnValue(of([make({ id: 'existing' })]));
      store.load();
      store.upsert(make({ id: 'new' }));
      expect(store.all().map(d => d.id)).toEqual(['new', 'existing']);
    });

    it('replaces an existing document in place', () => {
      const { store, api } = setup();
      api.list.and.returnValue(of([make({ id: 'd1', title: 'old' }), make({ id: 'd2' })]));
      store.load();
      store.upsert(make({ id: 'd1', title: 'updated' }));
      expect(store.all().map(d => d.title)).toEqual(['updated', 'Mutual NDA']);
    });
  });

  describe('rapid load cancels the prior in-flight request', () => {
    it('drops the first response when a second load arrives before it resolves', () => {
      const { store, api } = setup();
      const first = new Subject<DocumentListItem[]>();
      const second = new Subject<DocumentListItem[]>();
      api.list.and.returnValues(first.asObservable(), second.asObservable());

      store.load();
      store.load();

      first.next([make({ id: 'A' })]);
      expect(store.all().length).toBe(0);

      second.next([make({ id: 'B' })]);
      expect(store.all().map(d => d.id)).toEqual(['B']);
    });
  });

  describe('setContractType', () => {
    it('updates the cached document immediately (optimistic)', () => {
      const { store, api } = setup();
      api.list.and.returnValue(of([make({ id: 'd1', contract_type: null })]));
      store.load();
      const pending = new Subject<unknown>();
      api.update.and.returnValue(pending.asObservable());
      store.setContractType('d1', 'MSA');
      expect(store.all()[0]!.contract_type).toBe('MSA');
    });

    it('reverts the cached document if the request fails', () => {
      const { store, api } = setup();
      api.list.and.returnValue(of([make({ id: 'd1', contract_type: null })]));
      store.load();
      api.update.and.returnValue(throwError(() => new Error('boom')));
      store.setContractType('d1', 'MSA');
      expect(store.all()[0]!.contract_type).toBeNull();
      expect(store.error()).toBe('Could not update contract type');
    });

    it('does nothing if the document is not in the cache', () => {
      const { store, api } = setup();
      api.list.and.returnValue(of([]));
      store.load();
      store.setContractType('missing', 'MSA');
      expect(api.update).not.toHaveBeenCalled();
    });
  });
});
