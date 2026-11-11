import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap, catchError, of, forkJoin } from 'rxjs';
import { Drive } from '../drive';
import { FileEvent } from '../file-event';
import { FileEventsService } from '../file-events.service';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

type SortKey = 'file_name' | 'subfolder' | 'created' | 'owner' | 'size_bytes' | 'time';


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  private service = inject(FileEventsService);
  readonly auth = inject(AuthService);
  private router = inject(Router);

  async logout() { await this.auth.logout(); await this.router.navigate(['/login']); }

  readonly events = signal<FileEvent[]>([]);
  readonly drives = signal<Drive[]>([]);
  readonly error = signal<string | null>(null);
  readonly lastRefresh = signal<Date | null>(null);

  // filters
  readonly search = signal('');
  readonly owner = signal('');
  readonly subfolder = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');

  // sorting + paging
  readonly sortKey = signal<SortKey>('time');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly pageSize = 25;
  readonly page = signal(0);

  readonly owners = computed(() => [...new Set(this.events().map((e) => e.owner))].sort());
  readonly subfolders = computed(() => [...new Set(this.events().map((e) => e.subfolder))].sort());

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const owner = this.owner();
    const sub = this.subfolder();
    const from = this.dateFrom();
    const to = this.dateTo();

    const rows = this.events().filter((e) => {
      if (owner && e.owner !== owner) return false;
      if (sub && e.subfolder !== sub) return false;
      const day = e.created.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (q && !`${e.file_name} ${e.subfolder} ${e.owner}`.toLowerCase().includes(q)) return false;
      return true;
    });

    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly pageRows = computed(() => {
    const start = Math.min(this.page(), this.pageCount() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  readonly totalBytes = computed(() => this.filtered().reduce((sum, e) => sum + e.size_bytes, 0));

  constructor() {
    // load now, then every 5 seconds so new files appear on their own
     interval(5000)
    .pipe(
      startWith(0),
      switchMap(() =>
        forkJoin({
          events: this.service.getEvents(),
          drives: this.service.getDrives(),
        }).pipe(
          catchError(() => {
            this.error.set('Cannot reach the API. Is "npm run api" running?');
            return of(null);
          }),
        ),
      ),
      takeUntilDestroyed(inject(DestroyRef)),
    )
    .subscribe((data) => {
      if (!data) return;
      this.error.set(null);
      this.events.set(data.events);
      this.drives.set(data.drives);
      this.lastRefresh.set(new Date());
    });
  }

  usedPercent(d: Drive): number {
    return d.total ? Math.round((d.used / d.total) * 100) : 0;
  }

  setSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'file_name' || key === 'owner' || key === 'subfolder' ? 'asc' : 'desc');
    }
  }

  arrow(key: SortKey) {
    return this.sortKey() === key ? (this.sortDir() === 'asc' ? '▲' : '▼') : '';
  }

  onFilter(signalRef: { set(v: string): void }, event: Event) {
    signalRef.set((event.target as HTMLInputElement | HTMLSelectElement).value);
    this.page.set(0);
  }

  clearFilters() {
    this.search.set('');
    this.owner.set('');
    this.subfolder.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(0);
  }

  prev() {
    this.page.update((p) => Math.max(0, p - 1));
  }

  next() {
    this.page.update((p) => Math.min(this.pageCount() - 1, p + 1));
  }

  formatBytes(n: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return i === 0 ? `${v} B` : `${v.toFixed(2)} ${units[i]}`;
  }
}
