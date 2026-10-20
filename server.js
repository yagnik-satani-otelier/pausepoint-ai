'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { URL } = require('node:url');
const { validatePayload, buildPrompt, parseCapsule, fallbackCapsule, enforceCapsuleGuardrails } = require('./lib/core');

const ROOT = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 4175;
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';
const MAX_BODY = 30000;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
const CAPSULE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, summary: { type: 'string' }, workingOn: { type: 'string' },
    verified: { type: 'array', items: { type: 'string' } }, unverified: { type: 'array', items: { type: 'string' } },
    nextSteps: { type: 'array', items: { type: 'string' } }, firstCommand: { type: 'string' }, returnPrompt: { type: 'string' }
  },
  required: ['title','summary','workingOn','verified','unverified','nextSteps','firstCommand','returnPrompt'],
  additionalProperties: false
};

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''; let bytes = 0; let settled = false;
    req.on('data', chunk => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY) {
        settled = true;
        const e = new Error('Request is too large.'); e.statusCode = 413; reject(e); req.resume(); return;
      }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', e => { if (!settled) { settled = true; reject(e); } });
  });
}

async function ollamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1800) });
    if (!response.ok) return { ready: false, installed: false, model: MODEL, reason: 'Ollama did not respond successfully.' };
    const result = await response.json();
    const models = (result.models || []).map(m => m.name || '');
    const installed = models.some(name => name === MODEL || name.startsWith(`${MODEL}:`) || name.startsWith(MODEL));
    return { ready: true, installed, model: MODEL, reason: installed ? '' : `Model ${MODEL} is not installed.` };
  } catch { return { ready: false, installed: false, model: MODEL, reason: 'Ollama is unavailable. Template mode is ready.' }; }
}

function runGit(cwd, args, maxOutput = 6000) {
  return new Promise((resolve, reject) => {
    // Read-only fixed Git commands only. No shell interpolation and no user-supplied arguments.
    const child = spawn('git', args, { cwd, windowsHide: true, shell: false });
    let out = ''; let err = ''; let size = 0;
    child.stdout.on('data', b => { size += b.length; if (size <= maxOutput) out += b.toString('utf8'); });
    child.stderr.on('data', b => { if (err.length < 1200) err += b.toString('utf8'); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `Git exited with code ${code}.`)));
  });
}

async function captureGit(pathInput) {
  const target = String(pathInput || '').trim();
  if (!target || target.length > 800) throw new Error('Enter a local repository path.');
  const resolved = path.resolve(target);
  const stat = fs.statSync(resolved, { throwIfNoEntry: false });
  if (!stat || !stat.isDirectory()) throw new Error('That path is not an existing folder.');
  const root = await runGit(resolved, ['rev-parse', '--show-toplevel'], 2000);
  const branch = await runGit(root, ['branch', '--show-current'], 1000);
  const status = await runGit(root, ['status', '--short', '--branch'], 3000);
  const diffStat = await runGit(root, ['diff', '--stat'], 2500).catch(() => '');
  const lastCommits = await runGit(root, ['log', '-3', '--oneline'], 1500).catch(() => '');
  return { root, branch: branch || '(detached HEAD)', gitStatus: status || 'Working tree clean.', diffStat: diffStat || 'No unstaged tracked diff summary.', lastCommits: lastCommits || 'No recent commits found.' };
}

async function generateCapsule(input) {
  const payload = validatePayload('capsule', input);
  const status = await ollamaStatus();
  if (!status.ready || !status.installed) {
    return { mode: 'template', model: null, capsule: fallbackCapsule(payload), notice: status.reason || 'Ollama unavailable; used the built-in template.' };
  }
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: buildPrompt(payload), stream: false, format: CAPSULE_SCHEMA, options: { temperature: 0.15, num_predict: 900 } }),
      signal: AbortSignal.timeout(90000)
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
    const body = await response.json();
    const capsule = enforceCapsuleGuardrails(parseCapsule(body.response), payload);
    return { mode: 'local-ai', model: MODEL, capsule, notice: 'Generated with local Ollama inference. Check every fact before resuming.' };
  } catch (error) {
    return { mode: 'template', model: null, capsule: fallbackCapsule(payload), notice: `Local AI output could not be used (${String(error.message).slice(0, 110)}). Used built-in template instead.` };
  }
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`); }
  catch { send(res, 400, { error: 'Invalid URL.' }); return; }
  if (req.method === 'GET' && url.pathname === '/api/status') { send(res, 200, await ollamaStatus()); return; }
  if (req.method === 'POST' && url.pathname === '/api/git-snapshot') {
    try { send(res, 200, await captureGit((await readJson(req)).path)); }
    catch (e) { send(res, e.statusCode || 400, { error: e.message || 'Could not capture Git status.' }); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/capsule') {
    try { send(res, 200, await generateCapsule(await readJson(req))); }
    catch (e) { send(res, e.statusCode || 400, { error: e.message || 'Could not generate a resume capsule.' }); }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, { error: 'Method not allowed.' }); return; }
  let requestPath;
  try { requestPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname); }
  catch { send(res, 400, { error: 'Malformed URL path.' }); return; }
  const resolved = path.resolve(ROOT, `.${requestPath}`);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== path.join(ROOT, 'index.html')) { send(res, 403, { error: 'Forbidden.' }); return; }
  fs.readFile(resolved, (error, buffer) => {
    if (error) { send(res, 404, { error: 'Not found.' }); return; }
    const ext = path.extname(resolved).toLowerCase();
    send(res, 200, req.method === 'HEAD' ? '' : buffer, MIME[ext] || 'application/octet-stream');
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`PausePoint running at http://127.0.0.1:${PORT} · model=${MODEL} · local-only server`));
