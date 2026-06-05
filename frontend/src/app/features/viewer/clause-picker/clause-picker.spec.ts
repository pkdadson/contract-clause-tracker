import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ClauseTypesStore } from '../../../core/stores/clause-types.store';
import type { ClauseType } from '../../../core/types/api';
import { ClausePicker } from './clause-picker.component';

const FAKE_TYPES: ClauseType[] = [
  {
    id: 'liability',
    name: 'Limitation of Liability',
    description: 'caps damages',
    color_token: '--c-liability',
    sort_order: 1,
  },
  {
    id: 'payment',
    name: 'Payment Terms',
    description: 'fees and invoices',
    color_token: '--c-payment',
    sort_order: 6,
  },
];

describe('ClausePicker', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        { provide: ClauseTypesStore, useValue: { types: signal(FAKE_TYPES) } },
      ],
    }),
  );

  it('filters as the user types', () => {
    const fix = TestBed.createComponent(ClausePicker);
    fix.detectChanges();
    fix.componentInstance.query.set('payment');
    expect(fix.componentInstance.visible().map(t => t.id)).toEqual(['payment']);
  });

  it('emits set on Enter with the highlighted option', () => {
    const fix = TestBed.createComponent(ClausePicker);
    fix.detectChanges();
    let emitted: unknown = null;
    fix.componentInstance.picked.subscribe(e => (emitted = e));
    fix.componentInstance.active.set(1);
    fix.componentInstance.onKey(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(emitted).toEqual({ kind: 'set', clauseTypeId: 'payment' });
  });

  it('emits remove on Backspace when label is set and query is empty', () => {
    const fix = TestBed.createComponent(ClausePicker);
    fix.componentRef.setInput('currentLabel', FAKE_TYPES[0]);
    fix.detectChanges();
    let emitted: unknown = null;
    fix.componentInstance.picked.subscribe(e => (emitted = e));
    fix.componentInstance.onKey(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(emitted).toEqual({ kind: 'remove' });
  });

  it('does not remove on Backspace when query is non-empty', () => {
    const fix = TestBed.createComponent(ClausePicker);
    fix.componentRef.setInput('currentLabel', FAKE_TYPES[0]);
    fix.detectChanges();
    let emitted: unknown = null;
    fix.componentInstance.picked.subscribe(e => (emitted = e));
    fix.componentInstance.query.set('lia');
    fix.componentInstance.onKey(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(emitted).toBeNull();
  });

  it('emits cancel on Escape', () => {
    const fix = TestBed.createComponent(ClausePicker);
    fix.detectChanges();
    let emitted: unknown = null;
    fix.componentInstance.picked.subscribe(e => (emitted = e));
    fix.componentInstance.onKey(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitted).toEqual({ kind: 'cancel' });
  });

  it('clamps active index when arrowing past the visible bounds', () => {
    const fix = TestBed.createComponent(ClausePicker);
    fix.detectChanges();
    fix.componentInstance.active.set(0);
    fix.componentInstance.onKey(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(fix.componentInstance.active()).toBe(0);
    fix.componentInstance.active.set(1);
    fix.componentInstance.onKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(fix.componentInstance.active()).toBe(1);
  });
});
