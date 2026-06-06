import { OverlayModule } from '@angular/cdk/overlay';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { ScrollingModule as ScrollingExperimentalModule } from '@angular/cdk-experimental/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { fromEvent, merge } from 'rxjs';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';
import { DocumentDetailStore } from '../../core/stores/document-detail.store';
import { LiveAnnouncer } from '../../shared/a11y/live-announcer.service';
import type { Sentence } from '../../core/types/api';
import { ClausePicker, type PickerEvent } from './clause-picker/clause-picker.component';
import { SentenceComponent } from './sentence.component';
import { ViewerHeader } from './viewer-header.component';

interface Paragraph {
  id: number;
  sentences: Sentence[];
  streaming?: boolean;
}

@Component({
  selector: 'app-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  preserveWhitespaces: true,
  imports: [
    OverlayModule,
    ScrollingModule,
    ScrollingExperimentalModule,
    SentenceComponent,
    ClausePicker,
    ViewerHeader,
    RouterLink,
  ],
  styles: [
    `
      .streaming-placeholder {
        margin-top: 4px;
      }
      .streaming-placeholder .skeleton {
        height: 14px;
        margin-bottom: 12px;
        border-radius: 4px;
        background: linear-gradient(
          90deg,
          var(--surface-sunken) 0%,
          var(--border) 50%,
          var(--surface-sunken) 100%
        );
        background-size: 200% 100%;
        animation: viewer-shimmer 1.6s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .streaming-placeholder .skeleton {
          animation: none;
          background: var(--surface-sunken);
        }
      }
      @keyframes viewer-shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `,
  ],
  template: `
    @if (store.document(); as doc) {
      <app-viewer-header
        [doc]="doc"
        [labeled]="store.labeledCount()"
        [total]="store.sentenceCount()"
      />
      <div class="max-w-3xl mx-auto bg-surface my-6 md:my-10 rounded-lg shadow-sm">
        <cdk-virtual-scroll-viewport
          autosize
          [minBufferPx]="800"
          [maxBufferPx]="1600"
          class="block py-8 md:py-12"
          style="height: calc(100dvh - 9rem)"
        >
          <div
            *cdkVirtualFor="let p of paragraphs(); trackBy: trackByParagraph"
            class="px-6 md:px-16"
          >
            @if (p.streaming) {
              <div class="streaming-placeholder font-serif" role="status" aria-live="polite">
                <div class="skeleton" style="width: 92%"></div>
                <div class="skeleton" style="width: 78%"></div>
                <div class="skeleton" style="width: 56%"></div>
                <p class="text-sm text-ink-muted mt-4">
                  Parsing… {{ store.sentenceCount() }} sentences captured so far
                </p>
              </div>
            } @else if (isHeadingParagraph(p)) {
              <app-sentence
                [sentence]="p.sentences[0]"
                [disabled]="store.streaming()"
                (activate)="open(p.sentences[0].id, $event)"
              />
            } @else {
              <p class="font-serif text-[17px] leading-[1.8] mb-6 mt-0 text-ink">
                @for (s of p.sentences; track s.id) {
                  <app-sentence
                    [sentence]="s"
                    [disabled]="store.streaming()"
                    (activate)="open(s.id, $event)"
                  />
                }
              </p>
            }
          </div>
        </cdk-virtual-scroll-viewport>
      </div>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="originRef()!"
        [cdkConnectedOverlayOpen]="!!openId() && !!originRef()"
        [cdkConnectedOverlayHasBackdrop]="true"
        cdkConnectedOverlayBackdropClass="bg-transparent"
        (backdropClick)="close()"
        [cdkConnectedOverlayPositions]="positions"
      >
        @if (openSentence()) {
          <app-clause-picker
            [currentLabel]="currentLabel()"
            (picked)="onPicked(openId()!, $event)"
          />
        }
      </ng-template>
    } @else if (store.notFound()) {
      <div class="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <h1 class="font-serif text-2xl">This contract doesn't exist.</h1>
        <a routerLink="/" class="text-accent hover:underline">← Back to Contracts</a>
      </div>
    } @else if (store.error()) {
      <div class="max-w-3xl mx-auto px-8 py-10">
        <p class="text-danger" role="alert">{{ store.error() }}</p>
      </div>
    } @else if (store.loading()) {
      <header
        class="bg-surface border-b border-border px-4 md:px-8 py-3 md:py-4 flex flex-wrap items-center gap-3 md:gap-4 sticky top-0 z-20"
        aria-busy="true"
        aria-label="Loading contract"
      >
        <div class="h-5 w-24 bg-sunken rounded animate-pulse"></div>
        <div class="grow space-y-2 max-w-[260px]">
          <div class="h-5 w-48 bg-sunken rounded animate-pulse"></div>
          <div class="h-3 w-32 bg-sunken rounded animate-pulse"></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-sunken animate-pulse"></div>
        <div class="h-3 w-40 bg-sunken rounded animate-pulse"></div>
      </header>
      <div
        class="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8 bg-surface my-4 md:my-6 rounded shadow-sm border border-border space-y-3"
      >
        @for (n of [1, 2, 3, 4, 5, 6, 7, 8]; track n) {
          <div
            class="h-4 bg-sunken rounded animate-pulse"
            [style.width.%]="60 + (n % 4) * 12"
          ></div>
        }
      </div>
    }
  `,
})
export class ViewerPage implements OnInit {
  store = inject(DocumentDetailStore);
  private route = inject(ActivatedRoute);
  private clauseTypes = inject(ClauseTypesStore);
  private announcer = inject(LiveAnnouncer);
  private destroyRef = inject(DestroyRef);

  openId = signal<string | null>(null);
  originRef = signal<HTMLElement | null>(null);
  private openerElement: HTMLElement | null = null;
  private viewport = viewChild(CdkVirtualScrollViewport);

  paragraphs = computed<Paragraph[]>(() => {
    const doc = this.store.document();
    if (!doc) return [];
    const groups: Paragraph[] = [];
    let current: Paragraph | null = null;
    for (const s of doc.sentences) {
      if (!current || current.id !== s.paragraph_idx) {
        current = { id: s.paragraph_idx, sentences: [] };
        groups.push(current);
      }
      current.sentences.push(s);
    }
    if (this.store.streaming()) {
      groups.push({ id: -1, sentences: [], streaming: true });
    }
    return groups;
  });

  openSentence = computed(() => {
    const id = this.openId();
    if (!id) return null;
    return this.store.document()?.sentences.find(s => s.id === id) ?? null;
  });

  currentLabel = computed(() => {
    const s = this.openSentence();
    if (!s?.clause_type_id) return null;
    return this.clauseTypes.types().find(t => t.id === s.clause_type_id) ?? null;
  });

  readonly positions = [
    {
      originX: 'start' as const,
      originY: 'bottom' as const,
      overlayX: 'start' as const,
      overlayY: 'top' as const,
      offsetY: 6,
    },
    {
      originX: 'start' as const,
      originY: 'top' as const,
      overlayX: 'start' as const,
      overlayY: 'bottom' as const,
      offsetY: -6,
    },
  ];

  constructor() {
    effect(() => {
      const vp = this.viewport();
      if (!vp) return;
      const el = vp.elementRef.nativeElement;
      merge(
        fromEvent(el, 'wheel', { passive: true }),
        fromEvent(el, 'touchmove', { passive: true }),
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.openId()) this.close();
        });
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.store.load(id);
  }

  trackByParagraph = (_: number, p: Paragraph): number => p.id;

  isHeadingParagraph(p: Paragraph): boolean {
    const first = p.sentences[0];
    return p.sentences.length === 1 && !!first && first.is_heading;
  }

  open(sentenceId: string, anchor: HTMLElement): void {
    if (this.store.streaming()) return;
    this.openerElement = document.activeElement as HTMLElement | null;
    this.originRef.set(anchor);
    this.openId.set(sentenceId);
  }

  close(): void {
    this.openId.set(null);
    this.originRef.set(null);
    const opener = this.openerElement;
    this.openerElement = null;
    queueMicrotask(() => opener?.focus?.());
  }

  onPicked(sentenceId: string, event: PickerEvent): void {
    if (event.kind === 'cancel') {
      this.close();
      return;
    }
    if (event.kind === 'set') {
      const name =
        this.clauseTypes.types().find(t => t.id === event.clauseTypeId)?.name ?? event.clauseTypeId;
      this.store.setLabel(sentenceId, event.clauseTypeId, () =>
        this.announcer.announce('Could not save label. Try again.'),
      );
      this.announcer.announce(`Sentence labelled as ${name}`);
    } else {
      this.store.clearLabel(sentenceId, () =>
        this.announcer.announce('Could not remove label. Try again.'),
      );
      this.announcer.announce('Label removed');
    }
    this.close();
  }
}
