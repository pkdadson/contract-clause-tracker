import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UploadBus {
  readonly open = signal(false);
}
