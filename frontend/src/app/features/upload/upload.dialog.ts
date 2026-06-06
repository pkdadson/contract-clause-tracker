import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { DocumentsApi } from '../../core/api/documents.api';
import { DocumentDetailStore } from '../../core/stores/document-detail.store';
import { DocumentsStore } from '../../core/stores/documents.store';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['.txt', '.md'];

@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-40 bg-ink/40 grid place-items-center"
      (click)="!uploading() && close.emit()"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-h"
        aria-describedby="upload-desc"
        class="bg-surface rounded-lg shadow-xl p-6 w-[min(480px,92vw)]"
        (click)="$event.stopPropagation()"
      >
        <h2 id="upload-h" class="font-serif text-xl mb-1">Upload a contract</h2>
        <p id="upload-desc" class="text-ink-muted text-sm mb-4">
          Plain text or markdown, up to 5 MB.
        </p>

        <button
          #dropzone
          type="button"
          (click)="fileInput.click()"
          (dragover)="onDragOver($event)"
          (dragenter)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          [attr.aria-label]="'Upload contract — drop a file here or press Enter to choose'"
          class="block w-full border-2 border-dashed rounded-md py-8 px-4 text-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          [class.border-accent]="dragging()"
          [class.bg-accent-soft]="dragging()"
          [class.border-border-strong]="!dragging()"
          [class.bg-sunken]="!dragging()"
          [class.hover:border-accent]="!dragging()"
        >
          <div
            class="w-12 h-12 mx-auto rounded-md bg-accent-soft text-accent grid place-items-center mb-3"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M11 14V3M6 8l5-5 5 5M3 17h16" />
            </svg>
          </div>
          <div class="font-semibold text-ink">Drop your contract here</div>
          <div class="text-sm text-ink-muted mt-1">
            or
            <span class="text-accent underline">click to choose</span>
            a file
          </div>
          <div class="text-xs text-ink-faint mt-2">.txt or .md · up to 5 MB</div>
        </button>

        <input
          #fileInput
          type="file"
          accept=".txt,.md"
          class="sr-only"
          tabindex="-1"
          (change)="onPick($event)"
        />

        @if (error()) {
          <p role="alert" class="mt-3 text-sm text-danger">{{ error() }}</p>
        }
        @if (uploading()) {
          <p class="mt-3 text-sm text-ink-muted" aria-live="polite">Uploading…</p>
        }

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            (click)="close.emit()"
            class="px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink hover:bg-sunken rounded-md transition-colors duration-150"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
})
export class UploadDialog implements AfterViewInit, OnDestroy {
  close = output<void>();

  private api = inject(DocumentsApi);
  private store = inject(DocumentsStore);
  private detailStore = inject(DocumentDetailStore);
  private router = inject(Router);

  uploading = signal(false);
  error = signal<string | null>(null);
  dragging = signal(false);

  private dropzoneRef = viewChild<ElementRef<HTMLButtonElement>>('dropzone');
  private openerElement: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.openerElement = document.activeElement as HTMLElement | null;
    queueMicrotask(() => this.dropzoneRef()?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.openerElement?.focus?.();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.uploading()) this.close.emit();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  onPick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
  }

  private processFile(file: File): void {
    this.error.set(null);

    const dot = file.name.lastIndexOf('.');
    const ext = dot === -1 ? '' : file.name.slice(dot).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      this.error.set(`Files must be .txt or .md (got ${ext || 'no extension'})`);
      return;
    }
    if (file.size > MAX_BYTES) {
      this.error.set(`Files must be under 5 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }

    this.uploading.set(true);
    this.api.upload(file).subscribe({
      next: doc => {
        this.uploading.set(false);
        this.detailStore.upsert(doc);
        this.detailStore.streamProgress(doc.id);
        this.store.load();
        this.close.emit();
        this.router.navigate(['/documents', doc.id]);
      },
      error: e => {
        this.uploading.set(false);
        this.error.set(
          e?.error?.detail ?? e?.message ?? 'Upload failed. Try again.',
        );
      },
    });
  }
}
