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
});
