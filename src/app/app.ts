import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';

@Component({ selector: 'app-root', standalone: true, imports: [RouterOutlet], template: `@if (auth.ready()) { <router-outlet /> } @else { <main class="loading">Loading secure session…</main> }`, styles: [`.loading{min-height:100vh;display:grid;place-items:center;background:#071426;color:#b6d1e2;font:14px system-ui}`] })
export class App { readonly auth = inject(AuthService); constructor() { void this.auth.restore(); } }
