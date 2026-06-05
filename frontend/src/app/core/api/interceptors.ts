import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Observable, catchError, retry, throwError, timer } from 'rxjs';

export interface ApiError {
  status: number;
  message: string;
  isNetworkError: boolean;
  originalDetail?: unknown;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);
const MAX_GET_RETRIES = 2;

function backoffDelayMs(retryCount: number): number {
  // RxJS `retry` passes retryCount starting at 1, so subtract 1 for 0-indexed math.
  return Math.min(400 * 2 ** (retryCount - 1), 2_000);
}

export function httpRetryInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  if (req.method !== 'GET') return next(req);

  return next(req).pipe(
    retry({
      count: MAX_GET_RETRIES,
      delay: (error: unknown, retryCount: number) => {
        const status = error instanceof HttpErrorResponse ? error.status : -1;
        const retryable = status === 0 || RETRYABLE_STATUS.has(status);
        if (!retryable) return throwError(() => error);
        return timer(backoffDelayMs(retryCount));
      },
    }),
  );
}

export function httpErrorInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const normalized: ApiError = {
          status: err.status,
          message:
            (err.error as { detail?: string } | null)?.detail ?? err.statusText ?? 'Request failed',
          isNetworkError: err.status === 0,
          originalDetail: err.error,
        };
        return throwError(() => normalized);
      }
      return throwError(() => err);
    }),
  );
}
