const http = require('http');
const net = require('net');
const dns = require('dns').promises;
const PORT = process.env.PORT || 8080;
async function fetchTest(name, url) {
  const t = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'follow' });
    const txt = await r.text();
    return { name, url, ok: true, status: r.status, ms: Date.now() - t, bytes: txt.length };
  } catch (e) {
    return { name, url, ok: false, ms: Date.now() - t, error: String(e && e.cause ? (e.message + ' | cause: ' + e.cause) : e) };
  }
}
function tcpTest(name, host, port) {
  return new Promise(resolve => {
    const t = Date.now();
    const s = net.connect({ host, port, timeout: 6000 });
    s.on('connect', () => { s.destroy(); resolve({ name, host, port, ok: true, ms: Date.now() - t }); });
    s.on('timeout', () => { s.destroy(); resolve({ name, host, port, ok: false, ms: Date.now() - t, error: 'timeout' }); });
    s.on('error', e => resolve({ name, host, port, ok: false, ms: Date.now() - t, error: String(e.code || e.message) }));
  });
}
async function runTests() {
  const results = [];
  try { const t = Date.now(); const a = await dns.lookup('example.com'); results.push({ name: 'DNS example.com', ok: true, ms: Date.now() - t, address: a.address }); } catch (e) { results.push({ name: 'DNS example.com', ok: false, error: String(e.code || e.message) }); }
  results.push(await fetchTest('HTTPS example.com', 'https://example.com'));
  results.push(await fetchTest('HTTPS google.com', 'https://www.google.com'));
  results.push(await fetchTest('HTTPS api.github.com', 'https://api.github.com'));
  results.push(await fetchTest('HTTPS httpbin.org', 'https://httpbin.org/get'));
  results.push(await fetchTest('HTTP example.com port 80', 'http://example.com'));
  results.push(await tcpTest('TCP 1.1.1.1:443', '1.1.1.1', 443));
  results.push(await tcpTest('TCP 8.8.8.8:53', '8.8.8.8', 53));
  results.push(await tcpTest('TCP smtp.gmail.com:25', 'smtp.gmail.com', 25));
  results.push(await tcpTest('TCP github.com:22', 'github.com', 22));
  return results;
}
const server = http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, time: new Date().toISOString() })); return; }
  if (req.url === '/test-outbound') { const results = await runTests(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ time: new Date().toISOString(), results }, null, 2)); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Railway outbound test service</h1><p>It works. Time: ' + new Date().toISOString() + '</p><p><a href="/test-outbound">Run outbound tests (JSON)</a> | <a href="/health">health</a></p>');
});
server.listen(PORT, () => console.log('listening on ' + PORT));
