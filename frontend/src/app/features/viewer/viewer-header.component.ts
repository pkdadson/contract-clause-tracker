import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProgressRingComponent } from '../../shared/ui/progress-ring.component';
import type { DocumentDetail } from '../../core/types/api';

@Component({
  selector: 'app-viewer-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProgressRingComponent],
  template: `
    <header class="bg-surface border-b border-border px-4 md:px-8 py-3 md:py-4 flex flex-wrap items-center gap-3 md:gap-4 sticky top-0 z-20">
      <a routerLink="/"
         class="text-sm text-ink-muted hover:text-ink hover:bg-accent-soft/40 rounded-md px-2 py-2 -mx-2 min-h-[40px] inline-flex items-center"
         aria-label="Back to contracts">
        ← Contracts
      </a>
      <div class="grow">
        <h1 class="font-serif text-lg leading-tight">{{ doc().title }}</h1>
        <p class="text-xs text-ink-muted">{{ doc().party }} · {{ doc().contract_type }}</p>
      </div>
      <app-progress-ring [labeled]="labeled()" [total]="total()" />
      <p class="text-sm text-ink-muted">
        @if (total() === 0) {
          No sentences to label.
        } @else if (labeled() === total()) {
          All {{ total() }} sentences labelled ✓
        } @else {
          Click any sentence to label it · {{ labeled() }} of {{ total() }} labelled
        }
      </p>
    </header>
  `,
})
export class ViewerHeader {
  doc = input.required<DocumentDetail>();
  labeled = input.required<number>();
  total = input.required<number>();
}
