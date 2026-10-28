// Local preview only; exposes just the six module files on loopback.
// Run from the workspace: node scripts/serve_plan_fact.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Set(['index.html', 'styles.css', 'app.js', 'economics.js', 'data-source.js', 'demo-data.json']);
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/' || pathname === '/plan-fact') {
    response.writeHead(302, { Location: '/plan-fact/' }); response.end(); return;
  }
  const file = pathname === '/plan-fact/' ? 'index.html' : pathname.startsWith('/plan-fact/') ? pathname.slice(11) : '';
  if (!files.has(file)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const body = await readFile(new URL(`../plan-fact/${file}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': `${types[file.split('.').pop()]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500); response.end('Could not read module file');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(8039, '127.0.0.1', () => console.log('PLAN/FACT: http://127.0.0.1:8039/plan-fact/ (Ctrl+C to stop)'));
