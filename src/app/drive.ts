/** Disk space of one drive, from GET /api/drives (sizes in bytes) */
export interface Drive {
  drive: string; // "C:\"
  name: string; // name shown in File Explorer, e.g. "Local Disk (C:)" or "Data (D:)"
  fileSystem: string; // "NTFS", "exFAT", ...
  type: string; // "Local disk", "Removable", "Network", ...
  total: number;
  used: number;
  free: number;
}
