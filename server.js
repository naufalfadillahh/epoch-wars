// Epoch Wars — server mabar lokal (tanpa dependensi, cukup Node.js)
// Jalankan:  node server.js   lalu buka alamat yang tercetak di kedua perangkat.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const PORT = +process.env.PORT || 8123;
const FILES = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/net.js': ['net.js', 'text/javascript; charset=utf-8'] };

const peers = new Map(); // id -> {res, presence, chans:Set}
const send = (p, obj) => { try { p.res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch (e) {} };
function roster() {
  const list = [...peers].map(([id, p]) => ({ peer: id, presence: p.presence }));
  for (const p of peers.values()) send(p, { type: 'peers', peers: list });
}
function leaveCh(id, ch) {
  const p = peers.get(id);
  if (!p || !p.chans.delete(ch)) return;
  for (const [oid, o] of peers) if (oid !== id && o.chans.has(ch)) send(o, { type: 'left', ch, peer: id });
}
function handleOp(id, o) {
  const p = peers.get(id);
  if (!p || !o || typeof o !== 'object') return;
  const ch = typeof o.ch === 'string' ? o.ch.slice(0, 64) : '';
  if (o.t === 'join' && ch) p.chans.add(ch);
  else if (o.t === 'leave' && ch) leaveCh(id, ch);
  else if (o.t === 'presence') { p.presence = o.data && typeof o.data === 'object' ? o.data : {}; roster(); }
  else if (o.t === 'msg' && ch && p.chans.has(ch)) {
    const m = { type: 'msg', ch, topic: String(o.topic), peer: id, data: o.data };
    for (const [oid, q] of peers) if (oid !== id && q.chans.has(ch)) send(q, m);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/events') {
    const id = (url.searchParams.get('id') || '').slice(0, 40);
    if (!id) { res.writeHead(400); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    req.socket.setNoDelay(true);
    const old = peers.get(id);
    if (old) { for (const ch of [...old.chans]) leaveCh(id, ch); try { old.res.end(); } catch (e) {} }
    const p = { res, presence: {}, chans: new Set() };
    peers.set(id, p);
    send(p, { type: 'hello' });
    roster();
    const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch (e) {} }, 15000);
    req.on('close', () => {
      clearInterval(hb);
      if (peers.get(id) !== p) return;
      for (const ch of [...p.chans]) leaveCh(id, ch);
      peers.delete(id);
      roster();
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/send') {
    let body = '', bad = false;
    req.on('data', c => { body += c; if (body.length > 2e6) { bad = true; req.destroy(); } });
    req.on('end', () => {
      if (bad) return;
      try { const d = JSON.parse(body); if (Array.isArray(d.ops)) for (const o of d.ops.slice(0, 500)) handleOp(String(d.id), o); } catch (e) {}
      res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end();
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/lan') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"epochWarsLan":true}'); return; }
  const f = req.method === 'GET' && FILES[url.pathname];
  if (!f) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname, f[0]), (err, buf) => {
    if (err) { res.writeHead(500); res.end('Error'); return; }
    res.writeHead(200, { 'Content-Type': f[1], 'Cache-Control': 'no-store' }); res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log('\n  EPOCH WARS — server mabar lokal aktif\n');
  console.log('  Di komputer ini :  http://localhost:' + PORT);
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const a of list) if (a.family === 'IPv4' && !a.internal) console.log('  Untuk teman     :  http://' + a.address + ':' + PORT + '   (' + name + ')');
  console.log('\n  Kedua perangkat harus di WiFi yang sama. Tekan Ctrl+C untuk berhenti.\n');
});
