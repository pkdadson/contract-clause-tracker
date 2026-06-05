import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';

@Component({
  selector: 'app-clause-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ct(); as type) {
      <span
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-border bg-surface"
        [attr.aria-label]="'Clause type: ' + type.name"
      >
        <span
          class="w-2 h-2 rounded-full"
          [style.background]="'var(' + type.color_token + ')'"
          aria-hidden="true"
        ></span>
        <span>{{ type.name }}</span>
      </span>
    }
  `,
})
export class ClauseChipComponent {
  clauseTypeId = input.required<string>();
  private store = inject(ClauseTypesStore);
  ct = computed(() => this.store.types().find(t => t.id === this.clauseTypeId()));
}
