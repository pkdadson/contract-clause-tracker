import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ClauseTypesStore } from './core/stores/clause-types.store';
import { DocumentsStore } from './core/stores/documents.store';
import { UploadDialog } from './features/upload/upload.dialog';
import { UploadBus } from './shared/services/upload-bus';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UploadDialog],
  template: `
    <a class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:text-ink focus:px-3 focus:py-2 focus:rounded-md focus:shadow"
       href="#main">Skip to main content</a>

    <div class="grid grid-cols-[260px_1fr] min-h-dvh">
      <aside class="bg-surface border-r border-border px-4 py-6 flex flex-col gap-6">
        <div>
          <div class="font-sans font-bold text-lg tracking-tight">Clause Tracker</div>
          <div class="text-ink-muted text-xs mt-0.5">Contract review</div>
        </div>
        <button type="button"
                (click)="bus.open.set(true)"
                class="bg-accent text-white font-medium py-2 px-3 rounded-md hover:opacity-90">
          + Upload
        </button>
        <nav class="text-sm">
          <div class="text-ink-muted text-[11px] uppercase tracking-wider font-medium mb-2">Workspace</div>
          <a routerLink="/" routerLinkActive="bg-accent-soft text-ink font-medium"
             [routerLinkActiveOptions]="{ exact: true }"
             class="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent-soft/60">
            <span>Contracts</span>
            <span class="text-xs tabular-nums text-ink-muted">{{ docs.all().length }}</span>
          </a>
        </nav>
      </aside>
      <main id="main" class="bg-canvas overflow-auto"><router-outlet /></main>
    </div>

    @if (bus.open()) {
      <app-upload-dialog (close)="bus.open.set(false)" />
    }
  `,
})
export class AppComponent {
  docs = inject(DocumentsStore);
  bus = inject(UploadBus);

  constructor() {
    inject(ClauseTypesStore).load();
    this.docs.load();
  }
}
