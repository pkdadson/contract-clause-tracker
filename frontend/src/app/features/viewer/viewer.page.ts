import { CdkOverlayOrigin, OverlayModule } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ClauseTypesStore } from '../../core/stores/clause-types.store';
import { DocumentDetailStore } from '../../core/stores/document-detail.store';
import { LiveAnnouncer } from '../../shared/a11y/live-announcer.service';
import { ClausePicker, type PickerEvent } from './clause-picker/clause-picker.component';
import { SentenceComponent } from './sentence.component';
import { ViewerHeader } from './viewer-header.component';

@Component({
  selector: 'app-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule, SentenceComponent, ClausePicker, ViewerHeader, RouterLink],
  template: `
    @if (store.document(); as doc) {
      <app-viewer-header
        [doc]="doc"
        [labeled]="store.labeledCount()"
        [total]="store.sentenceCount()"
      />
      <div
        class="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8 bg-surface my-4 md:my-6 rounded shadow-sm border border-border"
      >
        @for (s of doc.sentences; track s.id) {
          <span #anchor="cdkOverlayOrigin" cdkOverlayOrigin>
            <app-sentence [sentence]="s" (activate)="open(s.id, anchor)" />
          </span>
        }
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
      <div class="max-w-3xl mx-auto px-8 py-10 space-y-3" aria-busy="true">
        @for (n of [1, 2, 3, 4, 5]; track n) {
          <div
            class="h-4 bg-surface rounded animate-pulse"
            [style.width.%]="60 + (n % 3) * 15"
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

  openId = signal<string | null>(null);
  originRef = signal<CdkOverlayOrigin | null>(null);
  private openerElement: HTMLElement | null = null;

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

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.store.load(id);
  }

  open(sentenceId: string, anchor: CdkOverlayOrigin): void {
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
