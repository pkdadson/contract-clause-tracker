import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LiveAnnouncer {
  private doc = inject(DOCUMENT);
  private region: HTMLElement | null = null;

  announce(msg: string): void {
    const el = this.getRegion();
    el.textContent = '';
    setTimeout(() => (el.textContent = msg), 10);
  }

  private getRegion(): HTMLElement {
    if (this.region) return this.region;
    const el = this.doc.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.className = 'sr-only';
    this.doc.body.appendChild(el);
    this.region = el;
    return el;
  }
}
