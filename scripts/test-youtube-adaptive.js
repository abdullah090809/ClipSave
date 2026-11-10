// Usage (Node 18+, from the repo root):
//   node scripts/test-youtube-adaptive.js "<youtube url of the video that fails in the app>"
// Checks whether the separate high-quality video-only and audio-only streams
// can be downloaded piece by piece (up to 40 MB each) without being refused.

const UA = 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BASE = process.env.YT_BASE || 'https://www.youtube.com';
const CHUNK = 4 * 1024 * 1024;
const MAX_TEST_BYTES = 40 * 1024 * 1024;

function videoId(input) {
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  const u = new URL(input);
  const parts = u.pathname.split('/').filter(Boolean);
  if (u.hostname.replace('www.', '') === 'youtu.be') return parts[0];
  if (parts[0] === 'watch') return u.searchParams.get('v');
  return parts[1];
}

async function timedFetch(url, headers) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    return await fetch(url, { headers, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryBytes(label, url, headers, wantBytes) {
  const t = Date.now();
  try {
    const res = await timedFetch(url, headers);
    if (!res.ok && res.status !== 206) {
      const body = await res.text().catch(() => '');
      console.log(`  ${label}: HTTP ${res.status} ${body.slice(0, 80).replace(/\s+/g, ' ')}`);
      return { ok: false, status: res.status };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const secs = (Date.now() - t) / 1000;
    console.log(`  ${label}: HTTP ${res.status}, got ${buf.length} of ${wantBytes} bytes in ${secs.toFixed(1)}s`);
    return { ok: buf.length > 0, status: res.status, bytes: buf.length };
  } catch (e) {
    console.log(`  ${label}: failed (${e.name}: ${e.message})`);
    return { ok: false, status: 0 };
  }
}

(async () => {
  const input = process.argv[2];
  if (!input) { console.log('Usage: node scripts/test-youtube-chunks.js <youtube url>'); process.exit(1); }
  const id = videoId(input);
  console.log('Video ID:', id);

  let visitor;
  try {
    const html = await (await fetch(`${BASE}/watch?v=${id}`, { headers: { 'User-Agent': WEB_UA } })).text();
    const m = html.match(/"VISITOR_DATA":"([^"]+)"/) || html.match(/"visitorData":"([^"]+)"/);
    visitor = m && m[1];
  } catch (e) { /* optional */ }

  const client = { clientName: 'ANDROID_VR', clientVersion: '1.65.10', deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12L', androidSdkVersion: 32, hl: 'en' };
  if (visitor) client.visitorData = visitor;
  const headers = { 'Content-Type': 'application/json', 'User-Agent': UA, 'X-YouTube-Client-Name': '28', 'X-YouTube-Client-Version': '1.65.10', Origin: 'https://www.youtube.com' };
  if (visitor) headers['X-Goog-Visitor-Id'] = visitor;

  const res = await fetch(`${BASE}/youtubei/v1/player?prettyPrint=false`, {
    method: 'POST', headers,
    body: JSON.stringify({ videoId: id, context: { client }, playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } }, contentCheckOk: true, racyCheckOk: true }),
  });
  const pr = await res.json();
  console.log('Playability:', (pr.playabilityStatus || {}).status, (pr.playabilityStatus || {}).reason || '');
  const sd = pr.streamingData || {};

  const dl = { 'User-Agent': UA };
  const adaptive = (sd.adaptiveFormats || []).filter(x => x.url);
  const avc = adaptive.filter(x => /avc1/.test(x.mimeType || '') && /video\/mp4/.test(x.mimeType || '')).sort((a, b) => (b.height || 0) - (a.height || 0));
  const picks = [];
  const hi = avc.find(x => (x.height || 0) >= 1080) || avc[0];
  const mid = avc.find(x => (x.height || 0) <= 720 && (x.height || 0) >= 480);
  if (hi) picks.push(['video H.264', hi]);
  if (mid && mid !== hi) picks.push(['video H.264', mid]);
  const aud = adaptive.find(x => x.itag === 140) || adaptive.find(x => /audio\/mp4/.test(x.mimeType || ''));
  if (aud) picks.push(['audio AAC', aud]);
  if (!picks.length) { console.log('No H.264 / AAC adaptive streams offered.'); process.exit(2); }

  const results = [];
  for (const [kind, f] of picks) {
    const total = Number(f.contentLength) || 0;
    const limit = Math.min(total, MAX_TEST_BYTES);
    console.log(`\n${kind} itag ${f.itag} ${f.qualityLabel || f.audioQuality} (${(total / 1048576).toFixed(1)} MB total) - testing first ${(limit / 1048576).toFixed(0)} MB:`);
    const sep = f.url.includes('?') ? '&' : '?';
    let failedAt = -1;
    for (let start = 0; start < limit; start += CHUNK) {
      const end = Math.min(start + CHUNK, total) - 1;
      const r = await tryBytes(`piece ${start / CHUNK + 1}`, `${f.url}${sep}range=${start}-${end}`, dl, end - start + 1);
      if (!r.ok) { failedAt = start; break; }
    }
    results.push(`${kind} itag ${f.itag} ${f.qualityLabel || ''}: ${failedAt < 0 ? 'OK' : 'REFUSED at byte ' + failedAt}`);
  }
  console.log('\nSUMMARY');
  for (const r of results) console.log('  ' + r);
  process.exit(0);
})().catch(e => { console.log('Script error:', e.message); process.exit(1); });
