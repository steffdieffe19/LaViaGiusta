import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, BehaviorSubject, filter, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const token = localStorage.getItem('access_token');
  let authReq = req;

  // Clone request to add authorization header if token exists and target is our backend API
  if (token && req.url.includes('http://localhost:3000/api/v1')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  const authService = inject(AuthService);
  const http = inject(HttpClient);

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Catch 401 errors, but avoid intercepting auth login or refresh requests themselves to prevent infinite loops
      if (error.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
        return handle401Error(authReq, next, authService, http);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  http: HttpClient
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      return http.post<{ success: boolean; data: { tokens: { accessToken: string; refreshToken: string } } }>(
        'http://localhost:3000/api/v1/auth/refresh',
        { refreshToken }
      ).pipe(
        switchMap((res) => {
          isRefreshing = false;
          if (res && res.success && res.data?.tokens) {
            const newAccessToken = res.data.tokens.accessToken;
            const newRefreshToken = res.data.tokens.refreshToken;
            
            localStorage.setItem('access_token', newAccessToken);
            localStorage.setItem('refresh_token', newRefreshToken);
            refreshTokenSubject.next(newAccessToken);
            authService.loadSession();

            return next(request.clone({
              setHeaders: {
                Authorization: `Bearer ${newAccessToken}`
              }
            }));
          } else {
            authService.clearSession();
            return throwError(() => new Error('Refresh token invalid'));
          }
        }),
        catchError((err) => {
          isRefreshing = false;
          authService.clearSession();
          return throwError(() => err);
        })
      );
    } else {
      authService.clearSession();
      return throwError(() => new Error('No refresh token available'));
    }
  } else {
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap((token) => {
        return next(request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        }));
      })
    );
  }
}
