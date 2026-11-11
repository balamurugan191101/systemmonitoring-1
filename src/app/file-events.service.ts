import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Drive } from './drive';
import { FileEvent } from './file-event';

@Injectable({ providedIn: 'root' })
export class FileEventsService {
  private http = inject(HttpClient);

  /** Goes through proxy.conf.json to the Node API in /server */
  getEvents(): Observable<FileEvent[]> {
    return this.http.get<FileEvent[]>('/api/files');
  }

  getDrives(): Observable<Drive[]> {
    return this.http.get<Drive[]>('/api/drives');
  }
}
