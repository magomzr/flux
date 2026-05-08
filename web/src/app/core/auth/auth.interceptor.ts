import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Adjuntar token a todas las requests excepto auth
  const token = auth.getAccessToken();
  const isAuthEndpoint = req.url.includes('/auth/');

  const authReq = token && !isAuthEndpoint
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 en endpoint no-auth → intentar refresh
      if (error.status === 401 && !isAuthEndpoint) {
        const refresh$ = auth.refresh();

        if (refresh$) {
          return refresh$.pipe(
            switchMap(() => {
              // Reintentar con el nuevo token
              const newToken = auth.getAccessToken();
              const retryReq = newToken
                ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
                : req;
              return next(retryReq);
            }),
            catchError(() => {
              // Refresh falló — limpiar sesión
              auth.logout();
              return throwError(() => error);
            }),
          );
        }

        auth.logout();
      }

      return throwError(() => error);
    }),
  );
};
