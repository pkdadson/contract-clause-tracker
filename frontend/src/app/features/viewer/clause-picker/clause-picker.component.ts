import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ClauseTypesStore } from '../../../core/stores/clause-types.store';
import type { ClauseType } from '../../../core/types/api';

export type PickerEvent =
  | { kind: 'set'; clauseTypeId: string }
  | { kind: 'remove' }
  | { kind: 'cancel' };

@Component({
  selector: 'app-clause-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-surface rounded-lg shadow-xl border border-border w-[360px] max-h-[460px] flex flex-col overflow-hidden"
      (keydown)="onKey($event)"
    >
      <div class="px-3 py-2 border-b border-border">
        <span id="picker-title" class="sr-only">Pick a clause type</span>
        <input
          #searchInput
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="picker-listbox"
          aria-labelledby="picker-title"
          [attr.aria-activedescendant]="activeId() ? 'opt-' + activeId() : null"
          [value]="query()"
          (input)="onSearchInput($event)"
          placeholder="Search clause types…"
          class="w-full bg-canvas border border-border rounded px-2 py-1.5 text-sm"
        />
      </div>

      @if (currentLabel(); as cur) {
        <button
          type="button"
          class="text-left text-sm text-danger px-3 py-2 border-b border-border hover:bg-canvas"
          (mousedown)="picked.emit({ kind: 'remove' })"
        >
          Remove label (currently
          <span class="font-medium">{{ cur.name }}</span>
          )
        </button>
      }

      <ul id="picker-listbox" role="listbox" class="overflow-auto" style="max-height: 320px;">
        @for (t of visible(); track t.id; let i = $index) {
          <li
            [id]="'opt-' + t.id"
            role="option"
            [attr.aria-selected]="i === active()"
            [class.bg-accent-soft]="i === active()"
            class="px-3 py-2 cursor-pointer hover:bg-accent-soft"
            (mousedown)="picked.emit({ kind: 'set', clauseTypeId: t.id })"
            (mouseenter)="active.set(i)"
          >
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                [style.background]="'var(' + t.color_token + ')'"
              ></span>
              <span class="font-medium text-sm">{{ t.name }}</span>
            </div>
            <p class="text-xs text-ink-muted ml-4 mt-0.5">{{ t.description }}</p>
          </li>
        }
        @if (visible().length === 0) {
          <li class="px-3 py-4 text-sm text-ink-muted">No matches.</li>
        }
      </ul>

      <footer
        class="px-3 py-1.5 border-t border-border bg-canvas/50 text-[11px] text-ink-muted font-mono"
      >
        <kbd class="px-1 bg-surface border border-border rounded">↵</kbd>
        apply ·
        <kbd class="px-1 bg-surface border border-border rounded">⌫</kbd>
        remove ·
        <kbd class="px-1 bg-surface border border-border rounded">esc</kbd>
        close
      </footer>
    </div>
  `,
})
export class ClausePicker {
  currentLabel = input<ClauseType | null>(null);
  picked = output<PickerEvent>();

  private store = inject(ClauseTypesStore);

  query = signal('');
  active = signal(0);

  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.store.types();
    if (!q) return all;
    return all.filter(
      t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  });

  activeId = computed(() => this.visible()[this.active()]?.id ?? '');

  constructor() {
    afterNextRender(() => this.searchInput()?.nativeElement.focus());
  }

  onSearchInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.update(i => Math.min(this.visible().length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.update(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = this.visible()[this.active()];
      if (opt) this.picked.emit({ kind: 'set', clauseTypeId: opt.id });
    } else if (e.key === 'Backspace' && this.currentLabel() && this.query() === '') {
      e.preventDefault();
      this.picked.emit({ kind: 'remove' });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.picked.emit({ kind: 'cancel' });
    }
  }
}
