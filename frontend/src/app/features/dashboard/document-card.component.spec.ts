import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DocumentsStore } from '../../core/stores/documents.store';
import type { ContractType, DocumentListItem } from '../../core/types/api';
import { DocumentCardComponent } from './document-card.component';

const make = (overrides: Partial<DocumentListItem>): DocumentListItem => ({
  id: overrides.id ?? 'd1',
  title: overrides.title ?? 'Mutual NDA',
  party: overrides.party ?? null,
  contract_type: overrides.contract_type === undefined ? 'NDA' : overrides.contract_type,
  uploaded_at: '2026-05-01T00:00:00',
  modified_at: '2026-05-10T00:00:00',
  sentence_count: overrides.sentence_count ?? 10,
  labeled_count: overrides.labeled_count ?? 0,
  clause_types_present: overrides.clause_types_present ?? [],
});

interface StoreMock {
  setContractType: jasmine.Spy<(id: string, value: ContractType | null) => void>;
}

const render = (doc: DocumentListItem) => {
  const store: StoreMock = { setContractType: jasmine.createSpy('setContractType') };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: DocumentsStore, useValue: store }],
  });
  const fixture: ComponentFixture<DocumentCardComponent> =
    TestBed.createComponent(DocumentCardComponent);
  fixture.componentRef.setInput('doc', doc);
  fixture.detectChanges();
  return { fixture, store };
};

describe('DocumentCardComponent', () => {
  it('renders the contract type when set', () => {
    const { fixture } = render(make({ contract_type: 'MSA' }));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('MSA');
  });

  it('initialises the dropdown selection to the current contract type', () => {
    const { fixture } = render(make({ contract_type: 'MSA' }));
    const select = fixture.nativeElement.querySelector(
      '[data-testid="type-select"]',
    ) as HTMLSelectElement;
    expect(select.value).toBe('MSA');
  });

  it('renders Unclassified and a ? badge when contract_type is null', () => {
    const { fixture } = render(make({ contract_type: null }));
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Unclassified');
    const badge = root.querySelector('[data-testid="type-badge"]');
    expect(badge?.textContent?.trim()).toBe('?');
  });

  it('calls the store when a new type is chosen from the dropdown', () => {
    const { fixture, store } = render(make({ id: 'd1', contract_type: null }));
    const select = fixture.nativeElement.querySelector(
      '[data-testid="type-select"]',
    ) as HTMLSelectElement;
    select.value = 'MSA';
    select.dispatchEvent(new Event('change'));
    expect(store.setContractType).toHaveBeenCalledWith('d1', 'MSA');
  });

  it('emits null when the user picks the Unclassified option', () => {
    const { fixture, store } = render(make({ id: 'd1', contract_type: 'MSA' }));
    const select = fixture.nativeElement.querySelector(
      '[data-testid="type-select"]',
    ) as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(store.setContractType).toHaveBeenCalledWith('d1', null);
  });

  it('keeps the picker outside the routerLink so it cannot trigger navigation', () => {
    const { fixture } = render(make({ contract_type: null }));
    const select = fixture.nativeElement.querySelector('[data-testid="type-select"]');
    expect(select?.closest('a')).toBeNull();
  });
});
