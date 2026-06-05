import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ClauseChipComponent } from '../../shared/ui/clause-chip.component';
import { ProgressRingComponent } from '../../shared/ui/progress-ring.component';
import type { DocumentListItem } from '../../core/types/api';

@Component({
  selector: 'tr[app-document-row]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ClauseChipComponent, ProgressRingComponent],
  template: `
    <td class="py-3 pr-4">
      <a [routerLink]="['/documents', doc().id]"
         class="font-medium hover:underline focus-visible:underline">
        {{ doc().title }}
      </a>
      <div class="text-xs text-ink-muted">{{ doc().party }}</div>
    </td>
    <td class="py-3 pr-4 text-sm text-ink-muted">{{ doc().contract_type }}</td>
    <td class="py-3 pr-4">
      <app-progress-ring [labeled]="doc().labeled_count" [total]="doc().sentence_count" />
    </td>
    <td class="py-3 pr-4">
      <div class="flex flex-wrap gap-1">
        @for (cid of doc().clause_types_present; track cid) {
          <app-clause-chip [clauseTypeId]="cid" />
        }
      </div>
    </td>
    <td class="py-3 pr-4 text-xs text-ink-muted tabular-nums">{{ modifiedLabel() }}</td>
  `,
})
export class DocumentRowComponent {
  doc = input.required<DocumentListItem>();
  modifiedLabel = computed(() => new Date(this.doc().modified_at).toLocaleDateString());
}
