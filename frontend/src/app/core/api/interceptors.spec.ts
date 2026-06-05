import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import {
  type ApiError,
  httpErrorInterceptor,
  httpRetryInterceptor,
} from './interceptors';

describe('httpRetryInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpRetryInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('retries a GET on 503 and resolves on the second attempt', fakeAsync(() => {
    let response: unknown = null;
    http.get('/widgets').subscribe(r => (response = r));

    controller.expectOne('/widgets').flush('busy', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    tick(500);

    controller.expectOne('/widgets').flush({ ok: true });
    expect(response).toEqual({ ok: true });
  }));

  it('does not retry a GET on 404', () => {
    let captured: unknown = null;
    http.get('/widgets/missing').subscribe({
      error: e => (captured = e),
    });
    controller.expectOne('/widgets/missing').flush('missing', {
      status: 404,
      statusText: 'Not Found',
    });
    expect(captured).toBeTruthy();
  });

  it('gives up after MAX_GET_RETRIES of 503 and surfaces the final error', fakeAsync(() => {
    let captured: unknown = null;
    http.get('/widgets').subscribe({ error: e => (captured = e) });

    controller.expectOne('/widgets').flush('busy', { status: 503, statusText: 'sub' });
    tick(500);
    controller.expectOne('/widgets').flush('busy', { status: 503, statusText: 'sub' });
    tick(1000);
    controller.expectOne('/widgets').flush('busy', { status: 503, statusText: 'sub' });

    expect(captured).toBeTruthy();
  }));

  it('does not retry a POST on 503', () => {
    let captured: unknown = null;
    http.post('/widgets', { name: 'x' }).subscribe({ error: e => (captured = e) });
    controller.expectOne('/widgets').flush('busy', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    expect(captured).toBeTruthy();
  });
});

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('normalizes HttpErrorResponse into ApiError, using detail when present', () => {
    let captured: ApiError | null = null;
    http.get('/labels').subscribe({ error: e => (captured = e) });
    controller.expectOne('/labels').flush(
      { detail: 'sentence is a heading' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(captured!.status).toBe(422);
    expect(captured!.message).toBe('sentence is a heading');
    expect(captured!.isNetworkError).toBeFalse();
  });

  it('flags status 0 responses as network errors', () => {
    let captured: ApiError | null = null;
    http.get('/labels').subscribe({ error: e => (captured = e) });
    controller.expectOne('/labels').error(new ProgressEvent('error'), { status: 0, statusText: '' });
    expect(captured!.status).toBe(0);
    expect(captured!.isNetworkError).toBeTrue();
  });
});
