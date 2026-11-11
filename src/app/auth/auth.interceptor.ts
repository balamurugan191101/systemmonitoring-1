import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const headers = auth.csrfToken() && !['GET','HEAD','OPTIONS'].includes(req.method) ? req.headers.set('X-CSRF-Token', auth.csrfToken()!) : req.headers;
  return next(req.clone({ withCredentials: true, headers })).pipe(catchError((err) => {
    if (err.status === 401 && !req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/csrf')) {
      auth.expire(); void router.navigate(['/login'], { queryParams: { expired: '1' } });
    } else if (err.status === 403 && !req.url.includes('/api/auth/')) {
      void router.navigate(['/forbidden']);
    }
    return throwError(() => err);
  }));
};
