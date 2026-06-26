// Tiny zero-dependency server for the Boostify deck:
//  - serves the static deck
//  - /api/state  : shared current-slide state (GET poll, POST control)
//  - /api/login  : validate the presenter PIN
//  - /api/forgot : email the PIN to the owner via Brevo
// Config (PIN, Brevo key, owner email) lives in presenter.config.json (gitignored).
// Run: node server.js   then open http://localhost:8800/
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let cfg = { pin: '4291', ownerEmail: '', senderEmail: '', senderName: 'Boostify Presentation', brevoKey: '', port: 8800 };
try { Object.assign(cfg, JSON.parse(fs.readFileSync(path.join(ROOT, 'presenter.config.json'), 'utf8'))); }
catch (e) { console.warn('No presenter.config.json — using defaults (PIN 4291, no email reset).'); }

// shared state (persisted, so a restart mid-talk resumes the current slide)
const STATE_FILE = path.join(ROOT, '.state.json');
let state = { slide: 0, rev: 0, by: null, t: Date.now() };
try { Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); } catch (e) {}
// Pre-serialized copy for the hot GET /api/state path (hundreds of viewers poll it),
// rebuilt only when state actually changes so the poll never re-stringifies under load.
let stateJSON = JSON.stringify(state);
function saveState() { fs.writeFile(STATE_FILE, JSON.stringify(state), function () {}); }
// Apply a control change: bump the revision, record who did it, persist, refresh the cached JSON.
// `by` is the controller's clientId for a normal advance, or null on a forced "recenter" so that
// EVERY attached follower re-applies (a follower ignores updates it believes came from itself).
function setSlide(slide, by) { state.slide = slide; state.rev++; state.by = by || null; state.t = Date.now(); stateJSON = JSON.stringify(state); saveState(); }
// In-memory cache of static files so 100-300 simultaneous loads never touch disk twice.
const staticCache = new Map(); // absolute file path -> { data, headers }
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
// Files that must never be served over HTTP (secrets + server internals).
const BLOCKED = new Set(['/presenter.config.json', '/server.js', '/build.js', '/package.json', '/package-lock.json', '/.state.json']);
let lastForgot = 0;
// PIN brute-force throttle: max 12 wrong tries / minute
let fails = [];
function blocked() { var n = Date.now(); fails = fails.filter(function (t) { return n - t < 60000; }); return fails.length >= 12; }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };

function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise(r => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); }); }

async function sendForgotEmail() {
  if (!cfg.brevoKey || !cfg.senderEmail || !cfg.ownerEmail) return { ok: false, reason: 'email not configured' };
  const payload = {
    sender: { name: cfg.senderName, email: cfg.senderEmail },
    to: [{ email: cfg.ownerEmail }],
    subject: 'Your Boostify presentation PIN',
    htmlContent: `<p>Your presentation control PIN is <strong style="font-size:20px;letter-spacing:3px">${cfg.pin}</strong>.</p>
                  <p>Enter it on the presentation to unlock presenter mode (notes + remote control).</p>
                  <p style="color:#888;font-size:12px">If you did not request this, you can ignore it.</p>`
  };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': cfg.brevoKey, 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) { const d = await r.text(); console.error('Brevo error', r.status, d); return { ok: false, reason: 'send failed' }; }
  return { ok: true };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  // ---- API ----
  // Hot path: hundreds of viewers poll this. Serve the pre-serialized string, never re-stringify.
  if (p === '/api/state' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(stateJSON); }
  if (p === '/api/state' && req.method === 'POST') {
    if (blocked()) return json(res, 429, { error: 'too many attempts' });
    const b = await readBody(req);
    if (String(b.pin) !== String(cfg.pin)) { fails.push(Date.now()); return json(res, 403, { error: 'bad pin' }); }
    // b.force = "recenter everyone": advance with by=null so every attached follower re-applies.
    if (typeof b.slide === 'number') { setSlide(b.slide, b.force ? null : (b.clientId || null)); }
    return json(res, 200, state);
  }
  if (p === '/api/login' && req.method === 'POST') {
    if (blocked()) return json(res, 429, { ok: false, reason: 'too many attempts, wait a minute' });
    const b = await readBody(req);
    const ok = String(b.pin) === String(cfg.pin);
    if (!ok) fails.push(Date.now());
    return json(res, ok ? 200 : 401, { ok: ok });
  }
  if (p === '/api/forgot' && req.method === 'POST') {
    const now = Date.now();
    if (now - lastForgot < 60000) return json(res, 429, { ok: false, reason: 'try again in a minute' });
    lastForgot = now;
    const r = await sendForgotEmail();
    // always 200-ish so we don't leak config; report ok flag
    return json(res, 200, { ok: r.ok, sent: r.ok });
  }

  // ---- static ----
  let rel = decodeURIComponent(p);
  if (rel === '/' || rel === '') rel = '/index.html';
  // Never serve secrets or server internals (the PIN/Brevo key live in presenter.config.json).
  if (BLOCKED.has(rel) || rel.indexOf('/.') === 0) { res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end('Not found'); }
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  // Serve from the in-memory cache once warmed, so a 300-person load never re-reads disk.
  const hit = staticCache.get(file);
  if (hit) { res.writeHead(200, hit.headers); return res.end(hit.data); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };
    // index.html stays fresh; everything else is safe to cache hard so Cloudflare and browsers absorb the load.
    headers['Cache-Control'] = (rel === '/index.html') ? 'no-cache' : 'public, max-age=600';
    if (data.length <= MAX_CACHE_BYTES) staticCache.set(file, { data: data, headers: headers });
    res.writeHead(200, headers); res.end(data);
  });
});

server.listen(cfg.port, cfg.host || undefined, () => console.log(`Boostify deck + presenter sync on http://${cfg.host || 'localhost'}:${cfg.port}/  (PIN gated)`));
