import { groupDocuments, searchAndFilter, sortDocuments } from './derivations';
import type { DocumentListItem } from '../../../core/types/api';

const make = (overrides: Partial<DocumentListItem>): DocumentListItem => ({
  id: overrides.id ?? 'd1',
  title: overrides.title ?? 'Mutual NDA',
  party: overrides.party ?? 'Acme Co',
  contract_type: overrides.contract_type ?? 'NDA',
  uploaded_at: '2026-05-01T00:00:00',
  modified_at: overrides.modified_at ?? '2026-05-10T00:00:00',
  sentence_count: 10,
  labeled_count: overrides.labeled_count ?? 0,
  clause_types_present: overrides.clause_types_present ?? [],
});

describe('searchAndFilter', () => {
  const docs = [
    make({ id: '1', title: 'Northwind MSA', party: 'Northwind GmbH', contract_type: 'MSA', clause_types_present: ['liability'] }),
    make({ id: '2', title: 'Helios NDA',    party: 'Helios Labs',    contract_type: 'NDA', clause_types_present: ['confidential'] }),
  ];

  it('matches title case-insensitively', () => {
    expect(searchAndFilter(docs, 'helios', new Set()).map(d => d.id)).toEqual(['2']);
  });

  it('matches party', () => {
    expect(searchAndFilter(docs, 'northwind', new Set()).map(d => d.id)).toEqual(['1']);
  });

  it('matches contract type', () => {
    expect(searchAndFilter(docs, 'nda', new Set()).map(d => d.id)).toEqual(['2']);
  });

  it('filters by clause type intersection', () => {
    expect(searchAndFilter(docs, '', new Set(['liability'])).map(d => d.id)).toEqual(['1']);
  });

  it('combines search and filter', () => {
    expect(searchAndFilter(docs, 'northwind', new Set(['confidential']))).toEqual([]);
  });

  it('returns everything when query and filter are empty', () => {
    expect(searchAndFilter(docs, '   ', new Set()).map(d => d.id)).toEqual(['1', '2']);
  });
});

describe('sortDocuments', () => {
  const docs = [
    make({ id: '1', title: 'Charlie', modified_at: '2026-05-01T00:00:00' }),
    make({ id: '2', title: 'Alpha',   modified_at: '2026-05-10T00:00:00' }),
    make({ id: '3', title: 'Bravo',   modified_at: '2026-05-05T00:00:00' }),
  ];

  it('sorts by modified date descending by default', () => {
    expect(sortDocuments(docs, 'modified-desc').map(d => d.id)).toEqual(['2', '3', '1']);
  });

  it('sorts by title ascending', () => {
    expect(sortDocuments(docs, 'title-asc').map(d => d.id)).toEqual(['2', '3', '1']);
  });

  it('does not mutate input', () => {
    const original = docs.map(d => d.id);
    sortDocuments(docs, 'title-asc');
    expect(docs.map(d => d.id)).toEqual(original);
  });
});

describe('groupDocuments', () => {
  const docs = [
    make({ id: '1', contract_type: 'MSA', clause_types_present: ['liability', 'payment'] }),
    make({ id: '2', contract_type: 'NDA', clause_types_present: ['confidential'] }),
    make({ id: '3', contract_type: 'MSA', clause_types_present: ['liability'] }),
  ];

  it('returns one group with everything when mode=none', () => {
    const groups = groupDocuments(docs, 'none');
    expect(groups.length).toBe(1);
    expect(groups[0].documents.length).toBe(3);
  });

  it('groups by contract type', () => {
    const groups = groupDocuments(docs, 'contract-type');
    const msa = groups.find(g => g.key === 'MSA');
    const nda = groups.find(g => g.key === 'NDA');
    expect(msa!.documents.map(d => d.id)).toEqual(['1', '3']);
    expect(nda!.documents.map(d => d.id)).toEqual(['2']);
  });

  it('clause-type grouping duplicates a doc once per clause-type present', () => {
    const groups = groupDocuments(docs, 'clause-type');
    const liability = groups.find(g => g.key === 'liability');
    const payment = groups.find(g => g.key === 'payment');
    expect(liability!.documents.map(d => d.id)).toEqual(['1', '3']);
    expect(payment!.documents.map(d => d.id)).toEqual(['1']);
  });
});
