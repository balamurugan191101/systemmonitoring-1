/** One line of storage_events.jsonl written by storage_monitor.py */
export interface FileEvent {
  time: string; // when the monitor detected the file
  user: string; // Windows user running the monitor
  event: string; // "file_added"
  file_name: string;
  subfolder: string; // path inside the watched folder, or "(root)"
  watched_root: string;
  full_path: string;
  created: string; // file creation date/time
  owner: string; // file owner
  size: string; // human readable, e.g. "47.08 KB"
  size_bytes: number;
}
