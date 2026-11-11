import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { AccessDeniedComponent } from './auth/access-denied.component';
import { authGuard, roleGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'forbidden', component: AccessDeniedComponent, canActivate: [authGuard] },
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard').then((m) => m.DashboardComponent), canActivate: [authGuard, roleGuard], data: { roles: ['Super Admin','Admin','IT Engineer','Viewer'] } },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
