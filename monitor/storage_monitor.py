"""
Storage monitor: logs every file that is added to the watched folders,
including the subfolder it was added in.

Install:  pip install watchdog pywin32     (pywin32 is only needed on Windows, for the file owner)
Run:      python storage_monitor.py
          python storage_monitor.py "D:\\Projects" "E:\\Shared"   (custom folders)

Each added file is written to:
  - storage_monitor.log     (human readable, rotating)
  - storage_events.jsonl    (one JSON object per line, easy to send to your server)
"""

import getpass
import json
import logging
import os
import string
import sys
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# ---------------------------------------------------------------- settings
LOG_DIR = Path(os.environ.get("PROGRAMDATA", Path.home())) / "StorageMonitor"
LOG_FILE = LOG_DIR / "storage_monitor.log"
JSONL_FILE = LOG_DIR / "storage_events.jsonl"

# Folders (anywhere in the path) that are noisy and not worth logging.
IGNORE_DIR_NAMES = {
    "$recycle.bin", "system volume information", "windows", "programdata",
    "appdata", "node_modules", ".git", "__pycache__", "storagemonitor",
}
# Temporary / partial-download file extensions.
IGNORE_EXTENSIONS = {".tmp", ".crdownload", ".part", ".partial", ".swp", ".lnk"}
IGNORE_PREFIXES = ("~$", ".~")
IGNORE_SUFFIXES = (".tmp", ".bak", ".swp", ".zstmp")

# Wait this long after the last event for a file before logging it, so
# size is final and duplicate create events are merged.
SETTLE_SECONDS = 1.0
# ------------------------------------------------------------------------


def setup_logging():
    global LOG_DIR, LOG_FILE, JSONL_FILE
    configured_dir = os.environ.get("STORAGE_MONITOR_LOG_DIR")
    fallback_base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    if configured_dir:
        configured_path = Path(configured_dir)
        if "\x00" in configured_dir or not configured_path.is_absolute() or ".." in configured_path.parts:
            raise ValueError("STORAGE_MONITOR_LOG_DIR must be an absolute path without '..' components")
        candidates = [configured_path]
    else:
        candidates = [LOG_DIR, Path(fallback_base) / "StorageMonitor"]
    handler = None
    last_error = None
    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            handler = RotatingFileHandler(candidate / "storage_monitor.log", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
            LOG_DIR = candidate
            LOG_FILE = candidate / "storage_monitor.log"
            JSONL_FILE = candidate / "storage_events.jsonl"
            break
        except OSError as exc:
            last_error = exc
    if handler is None:
        if last_error:
            raise last_error
        raise OSError("No writable storage monitor log directory is configured")
    logger = logging.getLogger("storage_monitor")
    logger.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter("%(asctime)s | %(message)s", "%Y-%m-%d %H:%M:%S"))
    logger.addHandler(handler)
    logger.addHandler(logging.StreamHandler(sys.stdout))
    return logger


def default_roots():
    """All existing drive roots on Windows, or the home folder elsewhere."""
    if os.name == "nt":
        drives = [f"{d}:\\" for d in string.ascii_uppercase if os.path.exists(f"{d}:\\")]
        return drives
    return [str(Path.home())]


def human_size(num_bytes: int) -> str:
    """12345 -> '12.06 KB'"""
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            return f"{int(size)} B" if unit == "B" else f"{size:.2f} {unit}"
        size /= 1024


def get_owner(path: str) -> str:
    """Owner of the file (needs pywin32 on Windows; falls back to current user)."""
    try:
        if os.name == "nt":
            import win32security
            sd = win32security.GetFileSecurity(path, win32security.OWNER_SECURITY_INFORMATION)
            name, domain, _ = win32security.LookupAccountSid(None, sd.GetSecurityDescriptorOwner())
            return f"{domain}\\{name}" if domain else name
        import pwd
        return pwd.getpwuid(os.stat(path).st_uid).pw_name
    except Exception:
        return getpass.getuser()


def get_created(path: str) -> str:
    """File creation date/time. On Windows getctime() is the creation time."""
    st = os.stat(path)
    ts = getattr(st, "st_birthtime", None) or st.st_ctime
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def should_ignore(path: str) -> bool:
    components = Path(path).parts or (os.path.basename(path),)
    return any(
        component.startswith(IGNORE_PREFIXES) or component.lower().endswith(IGNORE_SUFFIXES)
        for component in components
    )


def is_ignored(path: str) -> bool:
    p = Path(path)
    if should_ignore(path) or p.suffix.lower() in IGNORE_EXTENSIONS:
        return True
    return any(part.lower() in IGNORE_DIR_NAMES for part in p.parts)


class AddedFileHandler(FileSystemEventHandler):
    def __init__(self, root: str, logger, on_event=None):
        self.root = root
        self.logger = logger
        self.on_event = on_event      # optional hook, e.g. send over WebSocket
        self.pending = {}             # path -> time of last event
        self.user = getpass.getuser()

    # A new file, or a file copied/moved into the watched tree.
    def on_created(self, event):
        if not event.is_directory:
            self._queue(event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            self._queue(event.dest_path)

    def _queue(self, path):
        if not is_ignored(path):
            self.pending[path] = time.time()

    def flush(self):
        """Log files that have stopped changing."""
        now = time.time()
        for path, last in list(self.pending.items()):
            if now - last < SETTLE_SECONDS:
                continue
            del self.pending[path]
            self._log(path)

    def _log(self, path):
        try:
            size = os.path.getsize(path)
        except OSError:
            return  # file vanished (temp file) before we could log it

        full = Path(path)
        created = get_created(path)
        owner = get_owner(path)
        try:
            rel_folder = str(full.parent.relative_to(self.root))
        except ValueError:
            rel_folder = str(full.parent)
        if rel_folder == ".":
            rel_folder = "(root)"

        record = {
            "time": datetime.now().isoformat(timespec="seconds"),
            "user": self.user,
            "event": "file_added",
            "file_name": full.name,
            "subfolder": rel_folder,
            "watched_root": self.root,
            "full_path": str(full),
            "created": created,
            "owner": owner,
            "size": human_size(size),
            "size_bytes": size,
        }
        self.logger.info(
            "ADDED | %s | subfolder: %s | root: %s | created: %s | owner: %s | size: %s (%d bytes)",
            full.name, rel_folder, self.root, created, owner, human_size(size), size,
        )
        with open(JSONL_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        if self.on_event:
            try:
                self.on_event(record)
            except Exception as exc:  # never let the hook kill the monitor
                self.logger.info("on_event failed: %s", exc)


def run(roots, on_event=None):
    logger = setup_logging()
    observer = Observer()
    handlers = []
    for root in roots:
        if not os.path.isdir(root):
            logger.info("Skipping missing folder: %s", root)
            continue
        h = AddedFileHandler(root, logger, on_event)
        try:
            observer.schedule(h, root, recursive=True)   # recursive = includes all subfolders
        except OSError as exc:
            logger.info("Unable to watch %s: %s", root, exc)
            continue
        handlers.append(h)
        logger.info("Watching %s (including subfolders)", root)

    if not handlers:
        raise RuntimeError("No watched folders could be started. Check that the configured drives are available and accessible.")

    observer.start()
    try:
        while True:
            time.sleep(0.5)
            for h in handlers:
                h.flush()
    except KeyboardInterrupt:
        pass
    finally:
        observer.stop()
        observer.join()


if __name__ == "__main__":
    run(sys.argv[1:] or default_roots())
