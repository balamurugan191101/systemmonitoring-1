import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { DashboardComponent } from './dashboard/dashboard';
import { FileEventsService } from './file-events.service';
import { AuthService } from './auth/auth.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: FileEventsService, useValue: { getEvents: () => of([]), getDrives: () => of([]) } },
        { provide: AuthService, useValue: { ready: () => true, restore: async () => false, user: () => ({ username: 'tester', role: 'Viewer' }), logout: async () => {} } },
      ],
    }).compileComponents();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the page title', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Storage Monitor');
  });
});
