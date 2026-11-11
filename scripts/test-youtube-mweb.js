// Run on your PC:  node scripts\test-youtube-mweb.js "<youtube url>"
// Copies yt-dlp's "mweb" request (no PO token) and tests whether the 360p stream (itag 18)
// downloads piece by piece WITHOUT unscrambling the "n" parameter. Needs Node 18+.
const UA = 'Mozilla/5.0 (iPad; CPU OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const CHUNK = 4 * 1024 * 1024;
const MAX_BYTES = 40 * 1024 * 1024;
const https = require('https');
// fetch-like helper built on https so the response-header size limit can be raised
// (YouTube's mobile page sends more headers than Node's built-in fetch allows).
function hfetch(url, opts = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: opts.method || 'GET',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: { 'Accept-Encoding': 'identity', ...(opts.headers || {}) },
        maxHeaderSize: 1024 * 1024,
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
          res.resume();
          resolve(hfetch(new URL(res.headers.location, url).toString(), opts, redirects + 1));
          return;
        }
        const parts = [];
        res.on('data', (c) => parts.push(c));
        res.on('error', reject);
        res.on('end', () => {
          const buf = Buffer.concat(parts);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => buf.toString('utf8'),
            json: async () => JSON.parse(buf.toString('utf8')),
            arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
          });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout after 30s')));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const why = (e) => `${e.name}: ${e.message}${e.cause ? ` (${e.cause.code || ''} ${e.cause.message || e.cause})` : ''}`;


function videoId(input) {
  const m = String(input || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(input || '') ? input : null);
}

async function piece(url, start, end) {
  const t = Date.now();
  try {
    const res = await hfetch(`${url}${url.includes('?') ? '&' : '?'}range=${start}-${end}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return { ok: false, status: res.status };
    const buf = new Uint8Array(await res.arrayBuffer());
    return { ok: buf.length > 0, status: res.status, bytes: buf.length, secs: (Date.now() - t) / 1000 };
  } catch (e) {
    return { ok: false, status: 0, error: why(e) };
  }
}

async function attempt(url, total, label) {
  console.log(`\n${label}`);
  const limit = Math.min(total, MAX_BYTES);
  let got = 0;
  let secs = 0;
  for (let start = 0; start < limit; start += CHUNK) {
    const end = Math.min(start + CHUNK, total) - 1;
    const r = await piece(url, start, end);
    const n = start / CHUNK + 1;
    if (!r.ok) {
      console.log(`  piece ${n}: FAILED (HTTP ${r.status}${r.error ? ' ' + r.error : ''})`);
      return { ok: false, failedAt: start, got };
    }
    got += r.bytes;
    secs += r.secs;
    console.log(`  piece ${n}: HTTP ${r.status}, ${r.bytes} bytes in ${r.secs.toFixed(1)}s (${(r.bytes / 1048576 / Math.max(r.secs, 0.01)).toFixed(2)} MB/s)`);
  }
  return { ok: true, got, speed: got / 1048576 / Math.max(secs, 0.01) };
}

(async () => {
  const id = videoId(process.argv[2]);
  if (!id) { console.log('Usage: node scripts/test-youtube-mweb.js <youtube url>'); process.exit(1); }
  console.log('Video ID:', id);

  let host = 'm.youtube.com';
  let page;
  for (const h of ['m.youtube.com', 'www.youtube.com']) {
    try {
      page = await hfetch(`https://${h}/watch?v=${id}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
      host = h;
      break;
    } catch (e) {
      console.log(`Could not connect to ${h}: ${why(e)}`);
    }
  }
  if (!page) { console.log('Could not reach YouTube from this script. Send me this output.'); process.exit(2); }
  console.log('Using host:', host);
  const html = await page.text();
  console.log('Watch page: HTTP', page.status, `(${html.length} chars)`);
  const grab = (re) => { const m = html.match(re); return m ? m[1] : undefined; };
  const sts = grab(/"STS":(\d+)/);
  const clientVersion = grab(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || grab(/"clientVersion":"(2\.[0-9.]+)"/);
  const visitorData = grab(/"VISITOR_DATA":"([^"]+)"/) || grab(/"visitorData":"([^"]+)"/);
  console.log('Found: STS', sts, '| clientVersion', clientVersion, '| visitorData', visitorData ? 'yes' : 'no');
  if (!clientVersion) { console.log('Could not read the MWEB client version from the page. Send me this output.'); process.exit(2); }

  const client = { clientName: 'MWEB', clientVersion, hl: 'en', gl: 'US', userAgent: UA, platform: 'MOBILE' };
  if (visitorData) client.visitorData = visitorData;
  const body = {
    videoId: id,
    context: { client },
    playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS', ...(sts ? { signatureTimestamp: Number(sts) } : {}) } },
    contentCheckOk: true,
    racyCheckOk: true,
  };
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': UA,
    'X-YouTube-Client-Name': '2',
    'X-YouTube-Client-Version': clientVersion,
    Origin: `https://${host}`,
  };
  if (visitorData) headers['X-Goog-Visitor-Id'] = visitorData;
  const api = await hfetch(`https://${host}/youtubei/v1/player?prettyPrint=false`, { method: 'POST', headers, body: JSON.stringify(body) });
  const pr = await api.json().catch(() => null);
  console.log('Player API: HTTP', api.status, '| Playability:', pr && pr.playabilityStatus && pr.playabilityStatus.status, (pr && pr.playabilityStatus && pr.playabilityStatus.reason) || '');
  if (!pr || !pr.streamingData) { console.log('No streamingData in the response.'); process.exit(2); }

  const formats = pr.streamingData.formats || [];
  const adaptive = pr.streamingData.adaptiveFormats || [];
  console.log(`Formats: ${formats.length} combined, ${adaptive.length} adaptive (${adaptive.filter((f) => f.url).length} with a direct URL)`);
  const f18 = formats.find((f) => f.itag === 18);
  if (!f18) { console.log('No itag 18 in the response.'); process.exit(2); }
  if (!f18.url) { console.log('itag 18 has no direct url (it has', Object.keys(f18).join(', '), ') - needs signature deciphering.'); process.exit(2); }
  const total = Number(f18.contentLength) || 0;
  const nParam = new URL(f18.url).searchParams.get('n');
  console.log(`itag 18: ${f18.qualityLabel}, ${(total / 1048576).toFixed(1)} MB, n=${nParam}, c=${new URL(f18.url).searchParams.get('c')}`);
  if (!total) { console.log('No content length.'); process.exit(2); }

  const first = await attempt(f18.url, total, 'Attempt 1: immediately, n NOT unscrambled');
  let second;
  if (!first.ok) {
    console.log('\nWaiting 6 seconds (yt-dlp does a 5 second wait)...');
    await sleep(6000);
    second = await attempt(f18.url, total, 'Attempt 2: after waiting, n NOT unscrambled');
  }

  console.log('\nSUMMARY');
  const describe = (r) => (r.ok ? `OK, ${(r.got / 1048576).toFixed(0)} MB at ${r.speed.toFixed(2)} MB/s${r.speed < 0.5 ? ' (SLOW - looks throttled)' : ''}` : `FAILED at byte ${r.failedAt}`);
  console.log('  immediately:', describe(first));
  if (second) console.log('  after 6s wait:', describe(second));
  process.exit(0);
})().catch((e) => { console.log('Script error:', why(e)); process.exit(1); });