import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { DocumentDetailStore } from '../../core/stores/document-detail.store';
import { DocumentsStore } from '../../core/stores/documents.store';
import type { DocumentDetail } from '../../core/types/api';
import { UploadDialog } from './upload.dialog';

interface DetailStoreSpy {
  upsert: jasmine.Spy;
  streamProgress: jasmine.Spy;
}
interface ListStoreSpy {
  load: jasmine.Spy;
}

const shellDoc = (id = 'd1'): DocumentDetail => ({
  id,
  title: 'Sample',
  party: null,
  contract_type: null,
  uploaded_at: '2026-06-06T00:00:00',
  modified_at: '2026-06-06T00:00:00',
  sentences: [],
});

describe('UploadDialog', () => {
  let fixture: ComponentFixture<UploadDialog>;
  let http: HttpTestingController;
  let detailStore: DetailStoreSpy;
  let listStore: ListStoreSpy;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    detailStore = {
      upsert: jasmine.createSpy('upsert'),
      streamProgress: jasmine.createSpy('streamProgress'),
    };
    listStore = { load: jasmine.createSpy('load') };
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      imports: [UploadDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DocumentDetailStore, useValue: detailStore },
        { provide: DocumentsStore, useValue: listStore },
        { provide: Router, useValue: router },
      ],
    });
    fixture = TestBed.createComponent(UploadDialog);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  describe('backdrop click', () => {
    it('emits close when idle', () => {
      const spy = jasmine.createSpy('close');
      fixture.componentInstance.close.subscribe(spy);

      const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
      backdrop.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does NOT emit close while an upload is in flight', () => {
      const spy = jasmine.createSpy('close');
      fixture.componentInstance.close.subscribe(spy);
      fixture.componentInstance.uploading.set(true);
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
      backdrop.click();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('after a successful upload', () => {
    it('primes the detail store, kicks off streamProgress, refreshes the list, navigates, and closes', async () => {
      const closeSpy = jasmine.createSpy('close');
      fixture.componentInstance.close.subscribe(closeSpy);

      const file = new File(['hello'], 'sample.txt', { type: 'text/plain' });
      (fixture.componentInstance as unknown as { processFile: (f: File) => void }).processFile(file);

      const req = http.expectOne(`${environment.apiBase}/documents`);
      req.flush(shellDoc('d1'));

      await Promise.resolve();

      expect(detailStore.upsert).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'd1' }));
      expect(detailStore.streamProgress).toHaveBeenCalledWith('d1');
      expect(listStore.load).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/documents', 'd1']);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upsertOrder = (detailStore.upsert.calls.mostRecent() as any).invocationOrder as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const streamOrder = (detailStore.streamProgress.calls.mostRecent() as any).invocationOrder as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navigateOrder = (router.navigate.calls.mostRecent() as any).invocationOrder as number;
      expect(upsertOrder).toBeLessThan(streamOrder);
      expect(streamOrder).toBeLessThan(navigateOrder);
    });

    it('surfaces a backend validation error in the error slot', () => {
      const file = new File(['hello'], 'sample.txt', { type: 'text/plain' });
      (fixture.componentInstance as unknown as { processFile: (f: File) => void }).processFile(file);

      const req = http.expectOne(`${environment.apiBase}/documents`);
      req.flush({ detail: 'Files must be .txt or .md (got .pdf)' }, { status: 415, statusText: 'Unsupported' });

      expect(fixture.componentInstance.error()).toContain('.pdf');
      expect(detailStore.streamProgress).not.toHaveBeenCalled();
    });
  });
});
