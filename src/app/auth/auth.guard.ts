import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService), router = inject(Router);
  if (!auth.ready()) await auth.restore();
  return auth.user() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService), router = inject(Router);
  return !route.data['roles'] || route.data['roles'].includes(auth.user()?.role) ? true : router.createUrlTree(['/forbidden']);
};
