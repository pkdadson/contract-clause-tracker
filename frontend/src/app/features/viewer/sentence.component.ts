import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';
import type { Sentence } from '../../core/types/api';

@Component({
  selector: 'app-sentence',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sentence().is_heading) {
      <h3 class="font-serif text-xl md:text-2xl mt-8 mb-3 font-semibold tracking-tight text-ink">
        {{ sentence().text }}
      </h3>
    } @else if (disabled()) {
      <span class="text-ink-muted">{{ sentence().text }}</span>
    } @else {
      <span
        #btn
        role="button"
        tabindex="0"
        [attr.data-state]="state()"
        [style.--clause-color]="clauseColor()"
        [attr.aria-label]="ariaLabel()"
        [class.unlabeled-sentence]="!sentence().clause_type_id"
        [class.labeled-sentence]="!!sentence().clause_type_id"
        class="sentence-btn"
        (click)="activate.emit(btn)"
        (keydown.enter)="activate.emit(btn); $event.preventDefault()"
        (keydown.space)="activate.emit(btn); $event.preventDefault()"
      >
        {{ sentence().text }}
        @if (clauseName(); as name) {
          <span class="clause-chip" aria-hidden="true">
            <span class="clause-dot" [style.background]="clauseColor()"></span>
            {{ name }}
          </span>
        }
      </span>
    }
  `,
  styles: [
    `
      :host {
        display: inline;
      }
      .sentence-btn {
        cursor: pointer;
        border-radius: 2px;
        transition: background-color 150ms ease-out;
      }
      .sentence-btn:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .unlabeled-sentence:hover {
        background: var(--accent-soft);
      }
      .labeled-sentence {
        background: color-mix(in oklab, var(--clause-color) 14%, transparent);
        box-shadow: inset 0 -2px 0 var(--clause-color);
        padding: 0 3px;
      }
      .labeled-sentence:hover {
        background: color-mix(in oklab, var(--clause-color) 22%, transparent);
      }
      .clause-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-left: 6px;
        font-size: 11px;
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        font-weight: 500;
        color: var(--ink-muted);
        white-space: nowrap;
        vertical-align: middle;
      }
      .clause-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 999px;
      }
    `,
  ],
})
export class SentenceComponent {
  sentence = input.required<Sentence>();
  disabled = input<boolean>(false);
  activate = output<HTMLElement>();

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
