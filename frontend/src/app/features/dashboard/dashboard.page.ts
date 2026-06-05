import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';
import { DocumentsStore } from '../../core/stores/documents.store';
import { UploadBus } from '../../shared/services/upload-bus';
import { DocumentCardComponent } from './document-card.component';
import { EmptyStateComponent } from './empty-state.component';
import type { DocumentGroup, GroupMode, SortMode } from './utils/derivations';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocumentCardComponent, EmptyStateComponent],
  template: `
    <div class="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <header class="mb-6">
        <h1 class="font-serif text-3xl">Contracts</h1>
        <p class="text-ink-muted mt-1">
          Track which clauses live in which contracts across your portfolio.
        </p>
      </header>

      @if (all().length > 0) {
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div class="bg-surface border border-border rounded-md p-4">
            <div class="text-xs font-semibold text-ink-muted">Contracts</div>
            <div class="text-3xl font-bold tabular-nums tracking-tight mt-2">
              {{ all().length }}
            </div>
            <div class="text-xs text-ink-faint mt-1">across your portfolio</div>
          </div>
          <div class="bg-surface border border-border rounded-md p-4">
            <div class="text-xs font-semibold text-ink-muted">Sentences labelled</div>
            <div class="text-3xl font-bold tabular-nums tracking-tight mt-2 text-accent">
              {{ totalLabelled() }}
            </div>
            <div class="text-xs text-ink-faint mt-1">
              {{ clauseTypesCovered() }} clause
              {{ clauseTypesCovered() === 1 ? 'type' : 'types' }} covered
            </div>
          </div>
          <div class="bg-surface border border-border rounded-md p-4 col-span-2 md:col-span-1">
            <div class="text-xs font-semibold text-ink-muted">Coverage</div>
            <div class="text-3xl font-bold tabular-nums tracking-tight mt-2">
              {{ coveragePct() }}%
            </div>
            <div class="text-xs text-ink-faint mt-1">of sentences labelled</div>
          </div>
        </div>
      }

      @if (loading() && all().length === 0) {
        <div class="space-y-2" aria-busy="true" aria-live="polite">
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <div class="h-20 bg-surface border border-border rounded-md animate-pulse"></div>
          }
        </div>
      } @else if (error()) {
        <div
          role="alert"
          class="bg-surface border border-danger/30 text-danger rounded-md p-4 flex items-center justify-between"
        >
          <span>{{ error() }}</span>
          <button type="button" (click)="store.load()" class="underline">Retry</button>
        </div>
      } @else if (all().length === 0) {
        <app-empty-state (upload)="openUpload()" />
      } @else {
        <div class="flex items-center gap-3 mb-4 flex-wrap">
          <label class="grow max-w-md">
            <span class="sr-only">Search contracts</span>
            <input
              type="search"
              placeholder="Search contracts, parties, clauses…"
              [value]="store.searchQuery()"
              (input)="onSearch($event)"
              class="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(239,90,36,.15)] transition-[border-color,box-shadow] duration-150"
            />
          </label>

          <fieldset class="flex items-center gap-0.5 bg-sunken rounded-md p-1">
            <legend class="sr-only">Group by</legend>
            @for (g of groupOptions; track g.value) {
              <button
                type="button"
                (click)="setGrouping(g.value)"
                [attr.aria-pressed]="g.value === store.grouping()"
                class="px-3 py-1 text-xs font-semibold rounded transition-colors duration-150 {{
                  g.value === store.grouping()
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }}"
              >
                {{ g.label }}
              </button>
            }
          </fieldset>

          <button
            type="button"
            (click)="toggleSort()"
            class="bg-surface border border-border rounded-md px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:border-border-strong transition-colors duration-150"
          >
            Sort: {{ store.sort() === 'modified-desc' ? 'Modified' : 'Title' }}
          </button>
        </div>

        @if (filteredEmpty()) {
          <div class="bg-surface border border-border rounded-md text-center py-16 px-6">
            <p class="font-serif text-lg text-ink">No contracts match</p>
            <p class="text-sm text-ink-muted mt-1">Try a different search or clear the group.</p>
          </div>
        } @else {
          @for (group of store.grouped(); track group.key) {
            @if (store.grouping() !== 'none') {
              <div class="flex items-center gap-3 mt-6 mb-2.5">
                <span class="text-sm font-semibold text-ink">
                  {{ store.grouping() === 'clause-type' ? 'Documents containing ' : ''
                  }}{{ groupLabel(group) }}
                </span>
                <span
                  class="text-[11px] font-mono tabular-nums bg-sunken text-ink-faint px-2 py-0.5 rounded-full"
                >
                  {{ group.documents.length }}
                </span>
                <span class="flex-1 h-px bg-border"></span>
              </div>
            }
            <div class="flex flex-col gap-2">
              @for (doc of group.documents; track doc.id) {
                <app-document-card [doc]="doc" />
              }
            </div>
          }
        }
      }
    </div>
  `,
})
export class DashboardPage implements OnInit {
  store = inject(DocumentsStore);
  private clauseTypes = inject(ClauseTypesStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bus = inject(UploadBus);

  readonly groupOptions: { label: string; value: GroupMode }[] = [
    { label: 'No grouping', value: 'none' },
    { label: 'By contract type', value: 'contract-type' },
    { label: 'By clause type', value: 'clause-type' },
  ];

  all = this.store.all;
  loading = this.store.loading;
  error = this.store.error;
  filteredEmpty = computed(() => this.store.sorted().length === 0);

  totalLabelled = computed(() => this.all().reduce((sum, d) => sum + d.labeled_count, 0));
  clauseTypesCovered = computed(() => {
    const set = new Set<string>();
    for (const d of this.all()) {
      for (const ct of d.clause_types_present) set.add(ct);
    }
    return set.size;
  });
  coveragePct = computed(() => {
    const total = this.all().reduce((sum, d) => sum + d.sentence_count, 0);
    if (total === 0) return 0;
    return Math.round((this.totalLabelled() / total) * 100);
  });

  private params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  ngOnInit(): void {
    const p = this.params();
    this.store.searchQuery.set(p.get('q') ?? '');
    this.store.clauseFilter.set(new Set((p.get('clauses') ?? '').split(',').filter(Boolean)));
    this.store.grouping.set((p.get('group') as GroupMode) ?? 'none');
    this.store.sort.set((p.get('sort') as SortMode) ?? 'modified-desc');
    this.store.load();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.store.searchQuery.set(value);
    this._syncUrl({ q: value || null });
  }

  setGrouping(g: GroupMode): void {
    this.store.grouping.set(g);
    this._syncUrl({ group: g === 'none' ? null : g });
  }

  toggleSort(): void {
    const next: SortMode = this.store.sort() === 'modified-desc' ? 'title-asc' : 'modified-desc';
    this.store.sort.set(next);
    this._syncUrl({ sort: next });
  }

  openUpload(): void {
    this.bus.open.set(true);
  }

  groupLabel(group: DocumentGroup): string {
    const ct = this.clauseTypes.types().find(t => t.id === group.key);
    return ct ? ct.name : group.label;
  }

  private _syncUrl(patch: Record<string, string | null>): void {
    this.router.navigate([], { queryParams: patch, queryParamsHandling: 'merge' });
  }
}
