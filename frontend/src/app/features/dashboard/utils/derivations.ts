import type { DocumentListItem } from '../../../core/types/api';

export type GroupMode = 'none' | 'contract-type' | 'clause-type';
export type SortMode = 'modified-desc' | 'title-asc';

export interface DocumentGroup {
  key: string;
  label: string;
  documents: DocumentListItem[];
}

export function searchAndFilter(
  docs: ReadonlyArray<DocumentListItem>,
  query: string,
  clauseFilter: ReadonlySet<string>,
): DocumentListItem[] {
  const q = query.trim().toLowerCase();
  return docs.filter(d => {
    if (q) {
      const haystack = `${d.title} ${d.party ?? ''} ${d.contract_type}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (clauseFilter.size > 0) {
      const has = d.clause_types_present.some(c => clauseFilter.has(c));
      if (!has) return false;
    }
    return true;
  });
}

export function sortDocuments(
  docs: ReadonlyArray<DocumentListItem>,
  mode: SortMode,
): DocumentListItem[] {
  const out = [...docs];
  if (mode === 'title-asc') {
    out.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    out.sort((a, b) => b.modified_at.localeCompare(a.modified_at));
  }
  return out;
}

export function groupDocuments(
  docs: ReadonlyArray<DocumentListItem>,
  mode: GroupMode,
): DocumentGroup[] {
  if (mode === 'none') {
    return [{ key: 'all', label: 'All contracts', documents: [...docs] }];
  }
  if (mode === 'contract-type') {
    const map = new Map<string, DocumentListItem[]>();
    for (const d of docs) {
      const existing = map.get(d.contract_type);
      if (existing) existing.push(d);
      else map.set(d.contract_type, [d]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, documents]) => ({ key, label: key, documents }));
  }
  const map = new Map<string, DocumentListItem[]>();
  for (const d of docs) {
    for (const ct of d.clause_types_present) {
      const existing = map.get(ct);
      if (existing) existing.push(d);
      else map.set(ct, [d]);
    }
  }
  return [...map.entries()].map(([key, documents]) => ({ key, label: key, documents }));
}
