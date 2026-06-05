import { TestBed } from '@angular/core/testing';

import { ProgressRingComponent } from './progress-ring.component';

describe('ProgressRingComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('renders a labelled progress count', () => {
    const fix = TestBed.createComponent(ProgressRingComponent);
    fix.componentRef.setInput('labeled', 3);
    fix.componentRef.setInput('total', 10);
    fix.detectChanges();

    const wrapper = fix.nativeElement.querySelector('[aria-label]') as HTMLElement;
    expect(wrapper.getAttribute('aria-label')).toBe('3 of 10 sentences labelled');
    expect(wrapper.textContent).toContain('3/10');
  });

  it('zeroes the stroke offset at full progress', () => {
    const fix = TestBed.createComponent(ProgressRingComponent);
    fix.componentRef.setInput('labeled', 10);
    fix.componentRef.setInput('total', 10);
    fix.detectChanges();
    expect(fix.componentInstance.offset()).toBe(0);
  });

  it('treats zero total as one to avoid division by zero', () => {
    const fix = TestBed.createComponent(ProgressRingComponent);
    fix.componentRef.setInput('labeled', 0);
    fix.componentRef.setInput('total', 0);
    fix.detectChanges();
    expect(fix.componentInstance.offset()).toBe(fix.componentInstance.circumference);
  });
});
