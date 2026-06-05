import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center text-center gap-3 py-24">
      <h2 class="font-serif text-2xl">No contracts yet</h2>
      <p class="text-ink-muted max-w-sm">
        Upload your first contract to start labelling clauses by sentence.
      </p>
      <button type="button"
              (click)="upload.emit()"
              class="bg-accent text-white font-medium px-4 py-2 rounded-md hover:opacity-90">
        Upload your first contract
      </button>
    </div>
  `,
})
export class EmptyStateComponent {
  upload = output<void>();
}
