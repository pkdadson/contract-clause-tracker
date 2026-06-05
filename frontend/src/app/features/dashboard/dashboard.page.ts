import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';
import { DocumentsStore } from '../../core/stores/documents.store';
import { DocumentRowComponent } from './document-row.component';
import { EmptyStateComponent } from './empty-state.component';
import type { GroupMode, SortMode } from './utils/derivations';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocumentRowComponent, EmptyStateComponent],
  template: `
    <div class="max-w-6xl mx-auto px-8 py-10">
      <header class="mb-8">
        <h1 class="font-serif text-3xl">Contracts</h1>
        <p class="text-ink-muted mt-1">Search, filter, and group your contracts by clause type.</p>
      </header>

      @if (loading() && all().length === 0) {
        <div class="space-y-2" aria-busy="true" aria-live="polite">
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <div class="h-14 bg-surface border border-border rounded animate-pulse"></div>
          }
        </div>
      } @else if (error()) {
        <div role="alert"
             class="bg-surface border border-danger/30 text-danger rounded p-4 flex items-center justify-between">
          <span>{{ error() }}</span>
          <button type="button" (click)="store.load()" class="underline">Retry</button>
        </div>
      } @else if (all().length === 0) {
        <app-empty-state (upload)="openUpload()" />
      } @else {
        <div class="flex items-center gap-3 mb-4 flex-wrap">
          <label class="grow max-w-md">
            <span class="sr-only">Search contracts</span>
            <input type="search"
                   placeholder="Search by title, party, or type…"
                   [value]="store.searchQuery()"
                   (input)="onSearch($any($event.target).value)"
                   class="w-full bg-surface border border-border rounded-md px-3 py-2" />
          </label>

          <fieldset class="flex items-center gap-1 bg-surface border border-border rounded-md p-1">
            <legend class="sr-only">Group by</legend>
            @for (g of groupOptions; track g.value) {
              <button type="button"
                      (click)="setGrouping(g.value)"
                      [attr.aria-pressed]="g.value === store.grouping()"
                      class="px-3 py-1 text-sm rounded {{ g.value === store.grouping() ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink' }}">
                {{ g.label }}
              </button>
            }
          </fieldset>

          <button type="button"
                  (click)="toggleSort()"
                  class="bg-surface border border-border rounded-md px-3 py-1 text-sm">
            Sort: {{ store.sort() === 'modified-desc' ? 'Modified' : 'Title' }}
          </button>
        </div>

        @if (filteredEmpty()) {
          <p class="text-ink-muted text-center py-12">No contracts match your filters.</p>
        } @else {
          @for (group of store.grouped(); track group.key) {
            @if (store.grouping() !== 'none') {
              <h2 class="mt-6 mb-2 text-sm text-ink-muted">
                {{ store.grouping() === 'clause-type' ? 'Documents containing ' : '' }}
                <span class="text-ink font-medium">{{ groupLabel(group.key) }}</span>
                <span class="tabular-nums">({{ group.documents.length }})</span>
              </h2>
            }
            <table class="w-full bg-surface rounded border border-border overflow-hidden">
              <caption class="sr-only">Contracts</caption>
              <thead class="text-left text-xs uppercase text-ink-muted tracking-wider">
                <tr class="border-b border-border">
                  <th scope="col" class="py-2 pl-4 pr-4 font-medium">Contract</th>
                  <th scope="col" class="py-2 pr-4 font-medium">Type</th>
                  <th scope="col" class="py-2 pr-4 font-medium">Progress</th>
                  <th scope="col" class="py-2 pr-4 font-medium">Clauses</th>
                  <th scope="col" class="py-2 pr-4 font-medium">Modified</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border [&>tr>td:first-child]:pl-4">
                @for (doc of group.documents; track doc.id) {
                  <tr app-document-row [doc]="doc"></tr>
                }
              </tbody>
            </table>
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

  readonly groupOptions: { label: string; value: GroupMode }[] = [
    { label: 'No grouping', value: 'none' },
    { label: 'By contract type', value: 'contract-type' },
    { label: 'By clause type', value: 'clause-type' },
  ];

  all = this.store.all;
  loading = this.store.loading;
  error = this.store.error;
  filteredEmpty = computed(() => this.store.sorted().length === 0);

  private params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  ngOnInit(): void {
    const p = this.params();
    this.store.searchQuery.set(p.get('q') ?? '');
    this.store.clauseFilter.set(
      new Set((p.get('clauses') ?? '').split(',').filter(Boolean)),
    );
    this.store.grouping.set((p.get('group') as GroupMode) ?? 'none');
    this.store.sort.set((p.get('sort') as SortMode) ?? 'modified-desc');
  }

  onSearch(value: string): void {
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
    /* wired in Phase 4 */
  }

  groupLabel(key: string): string {
    const ct = this.clauseTypes.types().find(t => t.id === key);
    return ct ? ct.name : key;
  }

  private _syncUrl(patch: Record<string, string | null>): void {
    this.router.navigate([], { queryParams: patch, queryParamsHandling: 'merge' });
  }
}
