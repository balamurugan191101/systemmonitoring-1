const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const nodemailer = require('nodemailer');
const { readDrives } = require('../server/drive-info');
const TIME_ZONE = process.env.REPORT_TIMEZONE || 'Asia/Kolkata';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${unit ? value.toFixed(2) : value} ${units[unit]}`;
}

function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
}

function findEdge() {
  const candidates = [process.env.EDGE_PATH, process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'), process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')].filter(Boolean);
  const edge = candidates.find((candidate) => fs.existsSync(candidate));
  if (!edge) throw new Error('Microsoft Edge was not found. Set EDGE_PATH in .env to msedge.exe.');
  return edge;
}

function reportHtml(drives, generatedAt) {
  const cards = drives.map((drive) => {
    const percent = drive.total ? Math.min(100, Math.round((drive.used / drive.total) * 100)) : 0;
    const barColor = percent >= 90 ? '#fb7185' : '#25c8ed';
    return `<article class="drive"><div class="drive-icon">▣</div><div class="drive-info"><div class="drive-name">${escapeHtml(drive.name)}</div><div class="drive-meta">${escapeHtml(drive.type)}${drive.fileSystem ? ` · ${escapeHtml(drive.fileSystem)}` : ''}</div></div><div class="percent">${percent}%</div><div class="meter"><span style="width:${percent}%;background:${barColor}"></span></div><div class="stats"><span><b>${formatBytes(drive.used)}</b> used</span><span><b>${formatBytes(drive.free)}</b> free</span><span>${formatBytes(drive.total)} total</span></div></article>`;
  }).join('');
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: TIME_ZONE, dateStyle: 'full', timeStyle: 'short' }).format(generatedAt);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;padding:54px;background:#071426;color:#eaf6ff;font-family:Segoe UI,Arial,sans-serif}.report{max-width:1300px;margin:auto}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #24445c;padding-bottom:26px}.brand{color:#31c9e8;font-size:14px;font-weight:700;letter-spacing:3px}.brand span{color:#eaf6ff}.date{color:#9cb2c5;font-size:13px}.eyebrow{color:#37cce9;font-size:11px;letter-spacing:2px;margin:38px 0 9px}.title{font-size:38px;letter-spacing:-1px;margin:0}.sub{color:#9cb2c5;margin-top:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:32px}.drive{background:#102940;border:1px solid #24445c;border-radius:14px;padding:23px;display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:8px 14px}.drive-icon{width:44px;height:44px;border-radius:10px;background:#0b4057;color:#39d5ef;display:grid;place-items:center;font-size:22px}.drive-name{font-size:18px;font-weight:650}.drive-meta{font-size:12px;color:#93a9bc;margin-top:5px}.percent{font-size:25px;font-weight:700}.meter,.stats{grid-column:1/-1}.meter{height:8px;border-radius:8px;background:#274359;overflow:hidden;margin-top:10px}.meter span{display:block;height:100%;border-radius:8px}.stats{display:flex;justify-content:space-between;color:#9cb2c5;font-size:12px;margin-top:4px}.stats b{color:#eaf6ff}.footer{margin-top:32px;color:#708ca2;font-size:11px;letter-spacing:1px}.empty{margin-top:32px;background:#102940;border-radius:12px;padding:24px;color:#9cb2c5}@media(max-width:900px){.grid{grid-template-columns:1fr}}
</style></head><body><main class="report"><header class="top"><div class="brand">▤ <span>SYS</span>MONITOR</div><div class="date">${escapeHtml(time)} IST</div></header><p class="eyebrow">DAILY INFRASTRUCTURE SNAPSHOT</p><h1 class="title">Drive storage overview</h1><p class="sub">Current capacity and free space across available drives.</p>${drives.length ? `<section class="grid">${cards}</section>` : '<p class="empty">No drives are currently available on the monitored computer.</p>'}<footer class="footer">SYSTEM STORAGE MONITOR · AUTOMATED DAILY REPORT</footer></main></body></html>`;
}

function requiredConfig() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_TO'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Configure these .env settings before sending: ${missing.join(', ')}`);
}

async function main() {
  const preview = process.argv.includes('--preview');
  const generatedAt = new Date();
  const drives = readDrives();
  const date = localDate(generatedAt);
  const dateStamp = `${date.year}-${date.month}-${date.day}`;
  const tempRoot = path.join(__dirname, '..', '.report-tmp');
  fs.mkdirSync(tempRoot, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(tempRoot, 'storage-drive-report-'));
  const htmlPath = path.join(workDir, 'report.html');
  const imagePath = preview ? path.join(tempRoot, `drive-report-preview-${dateStamp}.png`) : path.join(workDir, 'drive-overview.png');
  fs.writeFileSync(htmlPath, reportHtml(drives, generatedAt), 'utf8');
  try {
    execFileSync(findEdge(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${path.join(workDir, 'edge-profile')}`, `--window-size=1440,${Math.max(580, 360 + drives.length * 180)}`, `--screenshot=${imagePath}`, pathToFileURL(htmlPath).href], { timeout: 45000, windowsHide: true, stdio: 'ignore' });
    if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size === 0) throw new Error('Edge did not create the drive report screenshot.');
    if (preview) { console.log(`Preview created: ${imagePath}`); return; }

    requiredConfig();
    const port = Number(process.env.SMTP_PORT);
    const secure = process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE.toLowerCase() === 'true';
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a valid port number.');
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure, requireTLS: !secure, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 30000 });
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO,
      subject: `Daily drive storage report · ${dateStamp}`,
      text: `Attached is the drive storage snapshot for ${dateStamp}.`,
      html: `<p>Attached is the drive storage snapshot for <b>${dateStamp}</b>.</p><p><img src="cid:drive-overview" alt="Daily drive storage overview" style="max-width:100%;height:auto"></p>`,
      attachments: [{ filename: `drive-storage-${dateStamp}.png`, path: imagePath, cid: 'drive-overview' }],
    });
    console.log(`Daily drive report sent for ${dateStamp}.`);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => { console.error(`Daily drive report failed: ${err.message}`); process.exitCode = 1; });
