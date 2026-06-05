import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { LabelsApi } from './labels.api';

describe('LabelsApi', () => {
  let api: LabelsApi;
  let http: HttpTestingController;
  const base = environment.apiBase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LabelsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LabelsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('PUTs the clause type id to the sentence label endpoint', () => {
    api.set('doc1', 'sent1', 'liability').subscribe();
    const req = http.expectOne(`${base}/documents/doc1/sentences/sent1/label`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ clause_type_id: 'liability' });
    req.flush({});
  });

  it('DELETEs the sentence label', () => {
    api.clear('doc1', 'sent1').subscribe();
    const req = http.expectOne(`${base}/documents/doc1/sentences/sent1/label`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
