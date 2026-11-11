const { execFileSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_TO'];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Configure these .env settings before scheduling: ${missing.join(', ')}`);

const taskName = 'StorageMonitor-DailyDriveReport';
const runner = path.join(__dirname, 'daily-drive-report.js');
const action = `"${process.execPath}" "${runner}"`;
execFileSync('schtasks.exe', ['/Create', '/SC', 'DAILY', '/ST', '09:00', '/TN', taskName, '/TR', action, '/F', '/IT'], { stdio: 'inherit', windowsHide: true });
console.log(`Scheduled ${taskName} daily at 9:00 AM Windows local time. The Windows account must be signed in at run time.`);
