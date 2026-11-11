// Usage (Node 18+, from the repo root):
//   node scripts\test-youtube-wait.js "<youtube url>" [maxMB=200]
// Downloads the 720p video-only stream in 4 MB pieces (nothing saved to disk).
// When YouTube answers 403, it WAITS and retries the same piece (every 10 s, then
// with a fresh URL every 3rd try) and reports how long the block lasted.
// Question it answers: is the 403 a temporary cooldown that a pause-and-retry loop can ride out?

const UA = 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CHUNK = 4 * 1024 * 1024;
const MAX_BYTES = (Number(process.argv[3]) || 200) * 1024 * 1024;
const RETRY_EVERY_MS = 10000;
const GIVE_UP_AFTER_MS = 6 * 60 * 1000;
const ITAG = 298;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const clock = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's';

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
  if (status !== 'OK') throw new Error('Playability ' + status);
  const f = ((pr.streamingData || {}).adaptiveFormats || []).find((x) => x.itag === ITAG && x.url);
  if (!f) throw new Error('itag ' + ITAG + ' not offered');
  return f;
}

async function piece(url, start, end) {
  const sep = url.includes('?') ? '&' : '?';
  try {
    const res = await fetch(`${url}${sep}range=${start}-${end}`, { headers: { 'User-Agent': UA } });
    if (!res.ok && res.status !== 206) return { status: res.status, bytes: 0 };
    return { status: res.status, bytes: (await res.arrayBuffer()).byteLength };
  } catch (e) { return { status: 0, bytes: 0 }; }
}

(async () => {
  const input = process.argv[2];
  if (!input) { console.log('Usage: node scripts\\test-youtube-wait.js <youtube url> [maxMB]'); process.exit(1); }
  const id = videoId(input);
  let f = await resolve(id);
  const total = Number(f.contentLength);
  const limit = Math.min(total, MAX_BYTES);
  console.log(`Video ${id}, 720p stream ${(total / 1048576).toFixed(0)} MB, testing ${(limit / 1048576).toFixed(0)} MB`);
  let pos = 0;
  const blocks = [];
  while (pos < limit) {
    const end = Math.min(pos + CHUNK, total) - 1;
    const r = await piece(f.url, pos, end);
    if (r.bytes > 0) { pos += r.bytes; continue; }
    console.log(`[${clock()}] refused (HTTP ${r.status}) at ${(pos / 1048576).toFixed(0)} MB -> waiting and retrying`);
    const blockStart = Date.now();
    let tries = 0, ok = false;
    while (Date.now() - blockStart < GIVE_UP_AFTER_MS) {
      await sleep(RETRY_EVERY_MS);
      tries++;
      if (tries % 3 === 0) { try { f = await resolve(id); } catch (e) { /* keep old url */ } }
      const rr = await piece(f.url, pos, end);
      if (rr.bytes > 0) { pos += rr.bytes; ok = true; break; }
    }
    const secs = Math.round((Date.now() - blockStart) / 1000);
    if (!ok) { console.log(`[${clock()}] still refused after ${secs}s -> giving up`); blocks.push(`block at ${(pos / 1048576).toFixed(0)} MB: NOT lifted after ${secs}s`); break; }
    console.log(`[${clock()}] allowed again after ${secs}s (${tries} tries)`);
    blocks.push(`block at ${((pos - 0) / 1048576).toFixed(0)} MB: lifted after ${secs}s`);
  }
  console.log('\nSUMMARY');
  console.log(`  reached ${(pos / 1048576).toFixed(0)} MB of ${(limit / 1048576).toFixed(0)} MB in ${clock().trim()}`);
  if (!blocks.length) console.log('  no refusals at all');
  for (const b of blocks) console.log('  ' + b);
  process.exit(0);
})().catch((e) => { console.log('Script error:', e.message); process.exit(1); });
