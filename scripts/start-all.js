const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env');
const config = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
const children = new Set();
let stopping = false;

function launch(label, command, args, { stopOnExit = true, env = process.env } = {}) {
  console.log(`Starting ${label}...`);
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, env });
  children.add(child);
  child.once('error', (err) => {
    console.error(`${label} could not start: ${err.message}`);
    if (!stopping) stop(1);
  });
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!stopping && stopOnExit) {
      console.error(`${label} stopped${signal ? ` (${signal})` : ` with code ${code}`}. Stopping the other services.`);
      stop(code || 1);
    } else if (!stopping && code !== 0) {
      console.error(`${label} failed with code ${code}. The main services are still running.`);
    }
  });
  return child;
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping Storage Monitor services...');
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 1500);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

const node = process.execPath;
const angularCli = path.join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
if (!fs.existsSync(angularCli)) {
  console.error('Angular CLI is missing. Run npm install first.');
  process.exit(1);
}

launch('Node API', node, [path.join(root, 'server', 'server.js')]);
launch('Angular dashboard', node, [angularCli, 'serve', '--open']);
const roots = String(config.MONITOR_ROOTS || '').split(';').map((item) => item.trim()).filter(Boolean);
const watcherEnv = config.STORAGE_MONITOR_LOG_DIR ? { ...process.env, STORAGE_MONITOR_LOG_DIR: config.STORAGE_MONITOR_LOG_DIR } : process.env;
launch('Python storage watcher', process.env.PYTHON || 'python', [path.join(root, 'monitor', 'storage_monitor.py'), ...roots], { env: watcherEnv });

const mailKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_TO'];
const missingMail = mailKeys.filter((key) => !config[key]?.trim());
if (missingMail.length) {
  console.log(`Daily email task not registered yet; configure ${missingMail.join(', ')} in .env.`);
} else {
  launch('Daily email task registration', node, [path.join(root, 'scripts', 'register-daily-drive-task.js')], { stopOnExit: false });
}

console.log('All available services started. Press Ctrl+C to stop the API, dashboard, and watcher. Any registered email task runs separately through Windows Task Scheduler.');
