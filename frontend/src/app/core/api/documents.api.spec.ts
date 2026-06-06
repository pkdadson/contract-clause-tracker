import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { DocumentsApi } from './documents.api';

describe('DocumentsApi', () => {
  let api: DocumentsApi;
  let http: HttpTestingController;
  const base = environment.apiBase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DocumentsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DocumentsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs the documents list', () => {
    api.list().subscribe();
    const req = http.expectOne(`${base}/documents`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('GETs a single document by id', () => {
    api.get('abc').subscribe();
    const req = http.expectOne(`${base}/documents/abc`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'abc' });
  });

  it('POSTs an upload as multipart FormData', () => {
    const file = new File(['hello'], 'sample.txt', { type: 'text/plain' });
    api.upload(file).subscribe();
    const req = http.expectOne(`${base}/documents`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBe(file);
    req.flush({ id: 'new' });
  });

  it('PATCHes the document with the new contract type', () => {
    api.update('doc-1', 'MSA').subscribe();
    const req = http.expectOne(`${base}/documents/doc-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ contract_type: 'MSA' });
    req.flush({});
  });

  it('PATCHes a null payload when clearing the type', () => {
    api.update('doc-1', null).subscribe();
    const req = http.expectOne(`${base}/documents/doc-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ contract_type: null });
    req.flush({});
  });

  describe('progressStream', () => {
    class FakeEventSource {
      static last: FakeEventSource | null = null;
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      closed = false;
      constructor(public url: string) {
        FakeEventSource.last = this;
      }
      close() {
        this.closed = true;
      }
      emit(data: unknown) {
        this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
      }
      error() {
        this.onerror?.(new Event('error'));
      }
    }

    let originalEventSource: typeof EventSource;

    beforeEach(() => {
      originalEventSource = (globalThis as unknown as { EventSource: typeof EventSource })
        .EventSource;
      (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
      FakeEventSource.last = null;
    });

    afterEach(() => {
      (globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
        originalEventSource;
    });

    it('opens an EventSource at the per-doc progress URL', () => {
      api.progressStream('doc-1').subscribe();
      expect(FakeEventSource.last?.url).toBe(`${base}/documents/doc-1/progress`);
    });

    it('emits parsed events for each data frame', () => {
      const received: unknown[] = [];
      api.progressStream('doc-1').subscribe(e => received.push(e));

      FakeEventSource.last!.emit({
        phase: 'sentences',
        items: [{ id: 's1', idx: 0, paragraph_idx: 0, text: 'Hi.', is_heading: false, clause_type_id: null }],
      });
      FakeEventSource.last!.emit({ phase: 'done', total: 1 });

      expect(received.length).toBe(2);
      expect((received[1] as { phase: string }).phase).toBe('done');
    });

    it('closes the EventSource and completes the Observable on `done`', () => {
      let completed = false;
      api.progressStream('doc-1').subscribe({ complete: () => (completed = true) });
      FakeEventSource.last!.emit({ phase: 'done', total: 0 });
      expect(completed).toBeTrue();
      expect(FakeEventSource.last!.closed).toBeTrue();
    });

    it('errors the Observable on an `error` phase event', () => {
      let err: unknown = null;
      api.progressStream('doc-1').subscribe({ error: e => (err = e) });
      FakeEventSource.last!.emit({ phase: 'error', message: 'boom' });
      expect((err as { message?: string })?.message).toBe('boom');
      expect(FakeEventSource.last!.closed).toBeTrue();
    });

    it('closes the EventSource on unsubscribe', () => {
      const sub = api.progressStream('doc-1').subscribe();
      sub.unsubscribe();
      expect(FakeEventSource.last!.closed).toBeTrue();
    });
  });
});
