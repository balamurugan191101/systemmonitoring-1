// Responsive audit screenshot helper. Requires Microsoft Edge and the Angular
// dev server on localhost:4200. Run with: node responsive-report/capture.cjs before
// or node responsive-report/capture.cjs after
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mode = process.argv[2] === 'after' ? 'after' : 'before';
const outputDir = path.join(__dirname, mode);
const edge = [
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
].find(fs.existsSync);
if (!edge) throw new Error('Microsoft Edge was not found.');

const viewports = [
  ...[320, 375, 414, 600, 768, 1024, 1280, 1440, 1920].map((width) => ({ width, height: width <= 600 ? 844 : width <= 1024 ? 900 : 1000 })),
  { width: 667, height: 375 },
  { width: 1024, height: 768 },
];
const pages = [
  { name: 'login', url: 'http://localhost:4200/login' },
  { name: 'dashboard-unauthenticated', url: 'http://localhost:4200/dashboard' },
  { name: 'forbidden-unauthenticated', url: 'http://localhost:4200/forbidden' },
  { name: 'workflow-overview', url: `file:///${path.join(root, 'workflow-overview.html').replaceAll('\\', '/')}` },
];
fs.mkdirSync(outputDir, { recursive: true });
const profile = path.join(__dirname, `.edge-profile-${mode}`);
const child = spawn(edge, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--remote-debugging-port=9229', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForDebugEndpoint() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { return await (await fetch('http://127.0.0.1:9229/json/version')).json(); }
    catch { await sleep(250); }
  }
  throw new Error('Edge DevTools endpoint did not start.');
}
async function createTarget() {
  const response = await fetch('http://127.0.0.1:9229/json/new?about:blank', { method: 'PUT' });
  if (!response.ok) throw new Error(`Could not create Edge page (${response.status}).`);
  return response.json();
}

async function main() {
  await waitForDebugEndpoint();
  const target = await createTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await call('Page.enable');
  await call('Runtime.enable');
  const metrics = [];
  for (const viewport of viewports) {
    await call('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1,
      mobile: viewport.width <= 768, screenWidth: viewport.width, screenHeight: viewport.height,
    });
    for (const page of pages) {
      await call('Page.navigate', { url: page.url });
      await sleep(page.name === 'workflow-overview' ? 700 : 4500);
      const result = await call('Runtime.evaluate', {
        expression: `({title:document.title, url:location.href, innerWidth, innerHeight, docWidth:document.documentElement.scrollWidth, bodyWidth:document.body?.scrollWidth || 0, docHeight:document.documentElement.scrollHeight})`,
        returnByValue: true,
      });
      const screenshot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      const filename = `${page.name}-${viewport.width}x${viewport.height}.png`;
      fs.writeFileSync(path.join(outputDir, filename), Buffer.from(screenshot.data, 'base64'));
      metrics.push({ page: page.name, requested: viewport, ...result.result.value, screenshot: filename });
      console.log(`${mode}: ${filename} ${result.result.value.docWidth}/${viewport.width}px document width`);
    }
  }
  fs.writeFileSync(path.join(outputDir, 'layout-measurements.json'), JSON.stringify(metrics, null, 2));
  ws.close();
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(() => { child.kill(); });
