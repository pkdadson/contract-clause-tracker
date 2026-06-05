import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DocumentsStore } from '../../core/stores/documents.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="px-8 py-8">
      <header class="mb-6">
        <h1 class="font-serif text-2xl">Contracts</h1>
        <p class="text-ink-muted text-sm mt-1">
          {{ docs.all().length }} loaded
        </p>
      </header>
    </section>
  `,
})
export class DashboardPage {
  docs = inject(DocumentsStore);
}
