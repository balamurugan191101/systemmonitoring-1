import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login', standalone: true, imports: [FormsModule], template: `
<main class="login-shell"><section class="visual" aria-label="Storage system status">
  <div class="brand"><span class="mark">▤</span><span>SYS<span class="cyan">MONITOR</span></span></div>
  <div class="visual-copy"><p class="eyebrow">INFRASTRUCTURE VISIBILITY</p><h1>Your storage<br>at a glance.</h1><p>Secure access to your organization's storage health and file activity.</p></div>
  <div class="storage-card"><div class="disk-icon">▣</div><div class="disk-meta"><span>Storage systems</span><strong>Monitoring active</strong></div><span class="live"><i></i>LIVE</span><div class="meter"><span></span></div><div class="meter-labels"><span>Storage utilization</span><span>68%</span></div></div>
  <div class="visual-foot">SYSTEM STORAGE MONITOR <span>•</span> SECURE ACCESS</div>
</section><section class="form-side"><div class="form-wrap"><div class="mobile-brand"><span class="mark">▤</span> SYS<span class="cyan">MONITOR</span></div>
  <p class="eyebrow">WELCOME BACK</p><h2>Sign in to your account</h2><p class="intro">Enter your credentials to access the monitoring dashboard.</p>
  @if (expired()) { <div class="notice" role="status">Your session expired. Sign in again to continue.</div> }
  @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
  <form (ngSubmit)="submit()"><label for="login">Username or email</label><input id="login" name="login" [(ngModel)]="login" autocomplete="username" required maxlength="254" placeholder="you@company.com">
    <div class="password-label"><label for="password">Password</label><button type="button" class="show" (click)="visible.update(v => !v)" [attr.aria-label]="visible() ? 'Hide password' : 'Show password'">{{ visible() ? 'Hide' : 'Show' }}</button></div>
    <input id="password" name="password" [(ngModel)]="password" [type]="visible() ? 'text' : 'password'" autocomplete="current-password" required maxlength="1024" placeholder="Enter your password">
    <label class="remember"><input type="checkbox" name="remember" [(ngModel)]="remember"> <span>Keep me signed in for 30 days</span></label>
    <button class="submit" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in securely' }} <span>→</span></button>
  </form><div class="security"><span>◈</span> Protected with encrypted session security</div><p class="help">Need access? Contact your system administrator.</p>
</div><footer>© {{ year }} System Storage Monitor <span>·</span> Authorized users only</footer></section></main>
`,
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth = inject(AuthService); private router = inject(Router); private route = inject(ActivatedRoute);
  login = ''; password = ''; remember = false; readonly busy = signal(false); readonly visible = signal(false); readonly error = signal(''); readonly expired = signal(false); readonly year = new Date().getFullYear();
  constructor() { this.expired.set(this.route.snapshot.queryParamMap.get('expired') === '1'); }
  async submit() { if (this.busy()) return; this.busy.set(true); this.error.set(''); try { await this.auth.login(this.login, this.password, this.remember); const target = this.route.snapshot.queryParamMap.get('returnUrl'); await this.router.navigateByUrl(target?.startsWith('/') ? target : '/dashboard'); } catch { this.error.set('Sign-in failed. Check your details or try again later.'); } finally { this.busy.set(false); } }
}
