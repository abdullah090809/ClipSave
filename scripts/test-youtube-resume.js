// Usage (Node 18+, from the repo root):
//   node scripts\test-youtube-resume.js "<youtube url>" [maxMB=150] [paceMs=0]
// Tests the idea: when YouTube refuses a piece (HTTP 403), ask YouTube for a FRESH
// stream URL and carry on from the same byte. If this reaches the end (or maxMB) for
// audio and 720p, the app can do the same. Nothing is saved to disk.

const UA = 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CHUNK = 4 * 1024 * 1024;
const MAX_BYTES = (Number(process.argv[3]) || 150) * 1024 * 1024;
const PACE_MS = Number(process.argv[4]) || 0;
const MAX_REFRESH = 25;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function videoId(input) {
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  const u = new URL(input);
  const parts = u.pathname.split('/').filter(Boolean);
  if (u.hostname.replace('www.', '') === 'youtu.be') return parts[0];
  if (parts[0] === 'watch') return u.searchParams.get('v');
  return parts[1];
}

async function resolve(id) {
  let visitor;
  try {
    const html = await (await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { 'User-Agent': WEB_UA } })).text();
    const m = html.match(/"VISITOR_DATA":"([^"]+)"/) || html.match(/"visitorData":"([^"]+)"/);
    visitor = m && m[1];
  } catch (e) { /* optional */ }
  const client = { clientName: 'ANDROID_VR', clientVersion: '1.65.10', deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12L', androidSdkVersion: 32, hl: 'en' };
  if (visitor) client.visitorData = visitor;
  const headers = { 'Content-Type': 'application/json', 'User-Agent': UA, 'X-YouTube-Client-Name': '28', 'X-YouTube-Client-Version': '1.65.10', Origin: 'https://www.youtube.com' };
  if (visitor) headers['X-Goog-Visitor-Id'] = visitor;
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST', headers,
    body: JSON.stringify({ videoId: id, context: { client }, playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } }, contentCheckOk: true, racyCheckOk: true }),
  });
  const pr = await res.json();
  const status = (pr.playabilityStatus || {}).status;
  if (status !== 'OK') throw new Error('Playability ' + status + ' ' + ((pr.playabilityStatus || {}).reason || ''));
  return (pr.streamingData || {}).adaptiveFormats || [];
}

async function piece(url, start, end) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}range=${start}-${end}`, { headers: { 'User-Agent': UA } });
  if (!res.ok && res.status !== 206) return { status: res.status, bytes: 0 };
  const buf = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, bytes: buf.length };
}

async function run(id, label, itag) {
  console.log(`\n== ${label} (itag ${itag}) ==`);
  let formats = await resolve(id);
  let f = formats.find((x) => x.itag === itag && x.url);
  if (!f) { console.log('  stream not offered'); return `${label}: not offered`; }
  const total = Number(f.contentLength);
  const limit = Math.min(total, MAX_BYTES);
  console.log(`  size ${(total / 1048576).toFixed(1)} MB, testing ${(limit / 1048576).toFixed(0)} MB`);
  let pos = 0, refreshes = 0, lastFailPos = -1;
  const failPoints = [];
  while (pos < limit) {
    const end = Math.min(pos + CHUNK, total) - 1;
    const r = await piece(f.url, pos, end);
    if (r.status === 403 || r.bytes === 0) {
      if (pos === lastFailPos) { console.log(`  fresh URL ALSO refused at byte ${pos} -> giving up`); return `${label}: STUCK at byte ${pos} (fresh URL refused too), refreshes ${refreshes}`; }
      if (refreshes >= MAX_REFRESH) return `${label}: stopped at byte ${pos} after ${refreshes} refreshes`;
      lastFailPos = pos;
      failPoints.push(pos);
      refreshes++;
      console.log(`  refused (HTTP ${r.status}) at byte ${pos} (${(pos / 1048576).toFixed(1)} MB) -> getting a fresh URL (#${refreshes})`);
      await sleep(1000);
      try {
        formats = await resolve(id);
        f = formats.find((x) => x.itag === itag && x.url) || f;
      } catch (e) { console.log('  re-resolve failed: ' + e.message); return `${label}: re-resolve failed at byte ${pos}`; }
      continue;
    }
    pos += r.bytes;
    if (PACE_MS) await sleep(PACE_MS);
  }
  const mb = (pos / 1048576).toFixed(0);
  const pts = failPoints.map((p) => (p / 1048576).toFixed(0) + 'MB').join(', ') || 'none';
  console.log(`  reached ${mb} MB, refusals at: ${pts}`);
  return `${label}: OK to ${mb} MB with ${refreshes} refresh(es) (refusals at ${pts})`;
}

(async () => {
  const input = process.argv[2];
  if (!input) { console.log('Usage: node scripts\\test-youtube-resume.js <youtube url> [maxMB] [paceMs]'); process.exit(1); }
  const id = videoId(input);
  console.log('Video ID:', id, ' pace:', PACE_MS + 'ms', ' max:', MAX_BYTES / 1048576 + 'MB');
  const results = [];
  results.push(await run(id, 'audio AAC', 140));
  results.push(await run(id, 'video 720p60 H.264', 298));
  console.log('\nSUMMARY');
  for (const r of results) console.log('  ' + r);
  process.exit(0);
})().catch((e) => { console.log('Script error:', e.message); process.exit(1); });
