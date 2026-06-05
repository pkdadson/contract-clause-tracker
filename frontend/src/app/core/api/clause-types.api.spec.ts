import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ClauseTypesApi } from './clause-types.api';

describe('ClauseTypesApi', () => {
  let api: ClauseTypesApi;
  let http: HttpTestingController;
  const base = environment.apiBase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ClauseTypesApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ClauseTypesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs the clause types list', () => {
    api.list().subscribe();
    const req = http.expectOne(`${base}/clause-types`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
