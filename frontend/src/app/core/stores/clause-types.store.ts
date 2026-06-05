import { Injectable, inject, signal } from '@angular/core';

import { ClauseTypesApi } from '../api/clause-types.api';
import type { ClauseType } from '../types/api';

@Injectable({ providedIn: 'root' })
export class ClauseTypesStore {
  private api = inject(ClauseTypesApi);

  readonly types = signal<ClauseType[]>([]);
  readonly loaded = signal(false);

  load(): void {
    if (this.loaded()) return;
    this.api.list().subscribe(types => {
      this.types.set(types);
      this.loaded.set(true);
    });
  }
}
