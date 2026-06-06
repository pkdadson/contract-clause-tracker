import { TestBed } from '@angular/core/testing';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';
import { SentenceComponent } from './sentence.component';

const stubStore = { types: () => [] };

const setup = (overrides: { disabled?: boolean; is_heading?: boolean } = {}) => {
  TestBed.configureTestingModule({
    imports: [SentenceComponent],
    providers: [{ provide: ClauseTypesStore, useValue: stubStore }],
  });
  const fixture = TestBed.createComponent(SentenceComponent);
  fixture.componentRef.setInput('sentence', {
    id: 's1',
    idx: 0,
    text: 'Hello.',
    is_heading: overrides.is_heading ?? false,
    clause_type_id: null,
  });
  if (overrides.disabled !== undefined) {
    fixture.componentRef.setInput('disabled', overrides.disabled);
  }
  fixture.detectChanges();
  return fixture;
};

describe('SentenceComponent', () => {
  it('renders a clickable button by default', () => {
    const fixture = setup();
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  });

  it('renders plain text (no button) when disabled is true', () => {
    const fixture = setup({ disabled: true });
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Hello.');
  });

  it('does not emit activate when disabled', () => {
    const fixture = setup({ disabled: true });
    const spy = jasmine.createSpy('activate');
    fixture.componentInstance.activate.subscribe(spy);
    fixture.nativeElement.click();
    expect(spy).not.toHaveBeenCalled();
  });
});
