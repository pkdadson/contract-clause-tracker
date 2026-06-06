import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';
import type { Sentence } from '../../core/types/api';

@Component({
  selector: 'app-sentence',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sentence().is_heading) {
      <h3 class="font-serif text-lg mt-6 mb-2 font-semibold">{{ sentence().text }}</h3>
    } @else if (disabled()) {
      <span class="block font-serif leading-relaxed py-2.5 px-2 -mx-2 text-ink-muted">
        {{ sentence().text }}
      </span>
    } @else {
      <button
        type="button"
        [attr.data-state]="state()"
        [style.--clause-color]="clauseColor()"
        [attr.aria-label]="ariaLabel()"
        [class.unlabeled-sentence]="!sentence().clause_type_id"
        [class.labeled-sentence]="!!sentence().clause_type_id"
        class="block w-full text-left font-serif leading-relaxed py-2.5 px-2 -mx-2 rounded text-ink transition-colors duration-150 focus-visible:bg-accent-soft"
        (click)="activate.emit()"
      >
        {{ sentence().text }}
        @if (clauseName(); as name) {
          <span
            class="ml-2 align-middle inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-sans font-medium border border-border bg-surface"
            aria-hidden="true"
          >
            <span class="w-1.5 h-1.5 rounded-full" [style.background]="clauseColor()"></span>
            {{ name }}
          </span>
        }
      </button>
    }
  `,
  styles: [
    `
      .unlabeled-sentence {
        text-decoration: underline dotted color-mix(in oklab, var(--ink-muted) 35%, transparent);
        text-underline-offset: 4px;
        text-decoration-thickness: 1px;
      }
      .unlabeled-sentence:hover {
        background: var(--accent-soft);
      }
      .labeled-sentence {
        border-left: 3px solid var(--clause-color);
        padding-left: 0.75rem;
      }
    `,
  ],
})
export class SentenceComponent {
  sentence = input.required<Sentence>();
  disabled = input<boolean>(false);
  activate = output<void>();

  private store = inject(ClauseTypesStore);

  state = computed<'labeled' | 'unlabeled'>(() =>
    this.sentence().clause_type_id ? 'labeled' : 'unlabeled',
  );

  clauseName = computed(() => {
    const id = this.sentence().clause_type_id;
    if (!id) return null;
    return this.store.types().find(t => t.id === id)?.name ?? null;
  });

  clauseColor = computed(() => {
    const id = this.sentence().clause_type_id;
    if (!id) return 'transparent';
    const token = this.store.types().find(t => t.id === id)?.color_token;
    return token ? `var(${token})` : 'transparent';
  });

  ariaLabel = computed(() => {
    const name = this.clauseName();
    return name
      ? `Sentence: ${this.sentence().text} — currently labelled ${name}. Press Enter to change.`
      : `Sentence: ${this.sentence().text} — unlabelled. Press Enter to label.`;
  });
}
