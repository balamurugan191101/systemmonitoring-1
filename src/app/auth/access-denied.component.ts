import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-access-denied', standalone: true, imports: [RouterLink], template: `<main><div class="panel"><span class="icon">403</span><h1>Access denied</h1><p>Your account does not have permission to view this page.</p><a routerLink="/dashboard">Return to dashboard</a></div></main>`, styles: [`:host{display:block;min-height:100vh;background:#071426;color:#e9f5fc;font-family:system-ui}main{min-height:100vh;display:grid;place-items:center}.panel{text-align:center;padding:42px;border:1px solid #24455f;background:#102940;border-radius:15px}.icon{color:#25c6e5;font-weight:800;letter-spacing:.2em}p{color:#a8bacb}a{display:inline-block;margin-top:18px;color:#48d7f0}`] })
export class AccessDeniedComponent {}
