import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('out');
const port = Number(process.env.WEBSITE_TEST_PORT ?? 4177);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return res.writeHead(400).end(); }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidates = [relative, relative + '.html'];
  for (const candidate of candidates) {
    const file = path.resolve(root, candidate);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
  }
  res.writeHead(404, { 'Content-Type': types['.html'] });
  res.end(fs.readFileSync(path.join(root, '404.html')));
}).listen(port, '127.0.0.1', () => console.log(`Built website: http://127.0.0.1:${port}`));
