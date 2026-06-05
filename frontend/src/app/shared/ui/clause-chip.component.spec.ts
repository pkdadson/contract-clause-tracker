import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';
import type { ClauseType } from '../../core/types/api';
import { ClauseChipComponent } from './clause-chip.component';

const TYPES: ClauseType[] = [
  {
    id: 'liability',
    name: 'Limitation of Liability',
    description: '',
    color_token: '--c-liability',
    sort_order: 1,
  },
];

describe('ClauseChipComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [{ provide: ClauseTypesStore, useValue: { types: signal(TYPES) } }],
    }),
  );

  it('renders the clause type name with an accessible label', () => {
    const fix = TestBed.createComponent(ClauseChipComponent);
    fix.componentRef.setInput('clauseTypeId', 'liability');
    fix.detectChanges();

    const span = fix.nativeElement.querySelector('span[aria-label]') as HTMLElement;
    expect(span).toBeTruthy();
    expect(span.getAttribute('aria-label')).toBe('Clause type: Limitation of Liability');
    expect(span.textContent).toContain('Limitation of Liability');
  });

  it('renders nothing when the clause type id is not in the store', () => {
    const fix = TestBed.createComponent(ClauseChipComponent);
    fix.componentRef.setInput('clauseTypeId', 'unknown');
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('span[aria-label]')).toBeNull();
  });
});
