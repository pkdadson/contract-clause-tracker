export const CONTRACT_TYPES = ['NDA', 'MSA', 'DPA', 'Employment', 'Reseller', 'Other'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export interface ClauseType {
  id: string;
  name: string;
  description: string;
  color_token: string;
  sort_order: number;
}

export interface Sentence {
  id: string;
  idx: number;
  text: string;
  is_heading: boolean;
  clause_type_id: string | null;
}

export interface DocumentListItem {
  id: string;
  title: string;
  party: string | null;
  contract_type: ContractType | null;
  uploaded_at: string;
  modified_at: string;
  sentence_count: number;
  labeled_count: number;
  clause_types_present: string[];
}

export interface DocumentDetail {
  id: string;
  title: string;
  party: string | null;
  contract_type: ContractType | null;
  uploaded_at: string;
  modified_at: string;
  sentences: Sentence[];
}

export interface Suggestion {
  id: string;
  sentence_id: string;
  clause_type_id: string;
  confidence: number;
}

export type IngestEvent =
  | { phase: 'sentences'; items: Sentence[] }
  | { phase: 'done'; total: number }
  | { phase: 'error'; message: string };
