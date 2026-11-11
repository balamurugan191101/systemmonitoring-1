import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AuthUser { id: string; username: string; email: string; role: 'Super Admin' | 'Admin' | 'IT Engineer' | 'Viewer'; }
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);
  private token: string | null = null;
  csrfToken() { return this.token; }
  expire() { this.user.set(null); this.token = null; }
  async restore(): Promise<boolean> {
    try {
      const csrf = await firstValueFrom(this.http.get<{csrfToken:string}>('/api/auth/csrf'));
      this.token = csrf.csrfToken;
      const me = await firstValueFrom(this.http.get<{user:AuthUser | null}>('/api/auth/me'));
      this.user.set(me.user); return me.user !== null;
    } catch { this.user.set(null); return false; }
    finally { this.ready.set(true); }
  }
  async login(login: string, password: string, remember = false): Promise<void> {
    const csrf = await firstValueFrom(this.http.get<{csrfToken:string}>('/api/auth/csrf'));
    this.token = csrf.csrfToken;
    const result = await firstValueFrom(this.http.post<{user:AuthUser;csrfToken:string}>('/api/auth/login', { login, password, remember }));
    this.user.set(result.user); this.token = result.csrfToken; this.ready.set(true);
  }
  async logout(): Promise<void> {
    try { await firstValueFrom(this.http.post('/api/auth/logout', {})); }
    finally { this.user.set(null); this.token = null; }
  }
}
