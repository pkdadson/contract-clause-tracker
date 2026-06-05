import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ClauseChipComponent } from '../../shared/ui/clause-chip.component';
import { DocumentsStore } from '../../core/stores/documents.store';
import { CONTRACT_TYPES, type ContractType, type DocumentListItem } from '../../core/types/api';

const TYPE_LABEL: Record<ContractType, string> = {
  NDA: 'NDA',
  MSA: 'MSA',
  DPA: 'DPA',
  Employment: 'EMP',
  Reseller: 'RSL',
  Other: 'DOC',
};

@Component({
  selector: 'app-document-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ClauseChipComponent],
  template: `
    <article
      class="bg-surface border border-border rounded-md px-4 py-4 hover:border-border-strong hover:shadow-md transition-all duration-150 focus-within:border-accent focus-within:shadow-md"
    >
      <div class="grid grid-cols-[44px_1fr_auto] gap-4 items-center">
        <a
          [routerLink]="['/documents', doc().id]"
          class="contents focus-visible:outline-none"
        >
          <div
            data-testid="type-badge"
            class="w-11 h-12 rounded-md bg-sunken border border-border grid place-items-center text-[10px] font-sans font-bold tracking-wide text-ink-muted"
            aria-hidden="true"
          >
            {{ typeBadge() }}
          </div>

          <div class="min-w-0">
            <div class="font-sans font-semibold text-[15px] tracking-tight text-ink truncate">
              {{ doc().title }}
            </div>
            <div class="flex items-center gap-2 mt-1 text-xs text-ink-faint truncate">
              @if (doc().party) {
                <span class="truncate max-w-[180px]">{{ doc().party }}</span>
                <span class="w-1 h-1 rounded-full bg-ink-faint/50" aria-hidden="true"></span>
              }
              <span [class.italic]="doc().contract_type === null">{{ typeLine() }}</span>
              <span class="w-1 h-1 rounded-full bg-ink-faint/50" aria-hidden="true"></span>
              <span>Updated {{ modifiedLabel() }}</span>
            </div>
            @if (doc().clause_types_present.length > 0) {
              <div class="flex flex-wrap gap-1.5 mt-2.5">
                @for (cid of visibleChips(); track cid) {
                  <app-clause-chip [clauseTypeId]="cid" />
                }
                @if (hiddenChipCount() > 0) {
                  <span
                    class="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-sunken text-ink-muted"
                  >
                    +{{ hiddenChipCount() }}
                  </span>
                }
              </div>
            } @else {
              <div class="text-xs text-ink-faint mt-2.5">No clauses labelled yet</div>
            }
          </div>
        </a>

        <div class="flex flex-col items-end gap-1.5 min-w-[120px]">
          <label class="sr-only" [attr.for]="'type-' + doc().id">Contract type</label>
          <select
            data-testid="type-select"
            [id]="'type-' + doc().id"
            class="text-[11px] bg-surface border border-border rounded-md px-1.5 py-1 hover:border-border-strong focus-visible:border-accent"
            (change)="onTypeChange($event)"
          >
            <option value="" [selected]="doc().contract_type === null">Unclassified</option>
            @for (t of types; track t) {
              <option [value]="t" [selected]="doc().contract_type === t">{{ t }}</option>
            }
          </select>
          <div
            class="w-[120px] h-1.5 bg-sunken rounded-full overflow-hidden"
            role="progressbar"
            [attr.aria-label]="progressLabel()"
            [attr.aria-valuenow]="doc().labeled_count"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="doc().sentence_count"
          >
            <div
              class="h-full bg-accent rounded-full transition-[width] duration-500"
              [style.width.%]="progressPct()"
            ></div>
          </div>
          <div class="text-[11px] text-ink-faint tabular-nums font-mono">
            {{ doc().labeled_count }}/{{ doc().sentence_count }}
          </div>
        </div>
      </div>
    </article>
  `,
})
export class DocumentCardComponent {
  private store = inject(DocumentsStore);

  doc = input.required<DocumentListItem>();
  readonly types = CONTRACT_TYPES;

  typeBadge = computed(() => {
    const t = this.doc().contract_type;
    return t === null ? '?' : TYPE_LABEL[t];
  });
  typeLine = computed(() => this.doc().contract_type ?? 'Unclassified');
  modifiedLabel = computed(() => relativeDate(this.doc().modified_at));
  visibleChips = computed(() => this.doc().clause_types_present.slice(0, 5));
  hiddenChipCount = computed(() => Math.max(0, this.doc().clause_types_present.length - 5));
  progressPct = computed(() => {
    const t = this.doc().sentence_count;
    return t === 0 ? 0 : Math.round((this.doc().labeled_count / t) * 100);
  });
  progressLabel = computed(
    () => `${this.doc().labeled_count} of ${this.doc().sentence_count} sentences labelled`,
  );

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const next: ContractType | null = value === '' ? null : (value as ContractType);
    this.store.setContractType(this.doc().id, next);
  }
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return 'today';
  if (diffMs < 2 * day) return 'yesterday';
  if (diffMs < 7 * day) return `${Math.round(diffMs / day)} days ago`;
  if (diffMs < 30 * day) return `${Math.round(diffMs / (7 * day))} weeks ago`;
  return new Date(iso).toLocaleDateString();
}
