// Usage (Node 18+, from the repo root):
//   node scripts/test-youtube-chunks.js "<youtube url of the video that fails in the app>"
// Downloads the 360p stream in 4 MB pieces exactly like the app does and shows
// which piece fails and why. Also checks whether higher quality / audio can download.

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
  const f = (sd.formats || []).find(x => x.itag === 18 && x.url) || (sd.formats || []).find(x => x.url);
  if (!f) { console.log('No muxed format offered.'); process.exit(2); }
  const total = Number(f.contentLength) || 0;
  console.log(`Stream: itag ${f.itag} ${f.qualityLabel}, ${(total / 1048576).toFixed(1)} MB. Testing the first ${Math.min(total, MAX_TEST_BYTES) / 1048576} MB in 4 MB pieces:`);

  const dl = { 'User-Agent': UA };
  const sep = f.url.includes('?') ? '&' : '?';
  let ok = true, got = 0, failedAt = -1;
  for (let start = 0; start < Math.min(total, MAX_TEST_BYTES); start += CHUNK) {
    const end = Math.min(start + CHUNK, total) - 1;
    const r = await tryBytes(`piece ${start / CHUNK + 1} (range=${start}-${end})`, `${f.url}${sep}range=${start}-${end}`, dl, end - start + 1);
    if (!r.ok) { ok = false; failedAt = start; break; }
    got += r.bytes;
  }
  if (!ok) {
    console.log(`\nFirst failure at byte ${failedAt}. Trying alternatives for that same piece:`);
    const end = Math.min(failedAt + CHUNK, total) - 1;
    await tryBytes('same piece with Range header', f.url, { ...dl, Range: `bytes=${failedAt}-${end}` }, end - failedAt + 1);
    await tryBytes('same piece, 1 MB size', `${f.url}${sep}range=${failedAt}-${failedAt + 1048575}`, dl, 1048576);
    await tryBytes('same piece, 10 MB size', `${f.url}${sep}range=${failedAt}-${Math.min(failedAt + 10 * 1048576, total) - 1}`, dl, 10 * 1048576);
  }
  console.log(ok ? `\nCHUNKS: all pieces OK (${(got / 1048576).toFixed(1)} MB).` : '\nCHUNKS: a piece FAILED (see above).');

  const adaptive = sd.adaptiveFormats || [];
  const vid = adaptive.filter(x => x.url && /video\/mp4/.test(x.mimeType || '') && (x.height || 0) >= 720).sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const aud = adaptive.find(x => x.url && x.itag === 140) || adaptive.find(x => x.url && /audio\/mp4/.test(x.mimeType || ''));
  console.log('\nHigher quality / audio tests:');
  let D = { ok: false }, E = { ok: false };
  if (vid) D = await tryBytes(`video-only itag ${vid.itag} ${vid.qualityLabel}`, `${vid.url}${vid.url.includes('?') ? '&' : '?'}range=0-1048575`, dl, 1048576);
  if (aud) E = await tryBytes(`audio-only itag ${aud.itag}`, `${aud.url}${aud.url.includes('?') ? '&' : '?'}range=0-524287`, dl, 524288);
  console.log(`\nSUMMARY  pieces: ${ok ? 'OK' : 'FAIL at ' + failedAt}   high-quality video: ${D.ok ? 'WORKS' : 'refused'}   audio-only: ${E.ok ? 'WORKS' : 'refused'}`);
  process.exit(0);
})().catch(e => { console.log('Script error:', e.message); process.exit(1); });
