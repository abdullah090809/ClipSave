// Run on your PC (Node 18+) BEFORE building the APK:
//   node scripts/test-youtube-local.js https://youtube.com/shorts/CKprBAODpX4
// It makes the same request the app will make and tries to download real bytes.
// Your PC uses your home IP, like your phone, so this is a good preview of the app.

const UA = 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BASE = process.env.YT_BASE || 'https://www.youtube.com';

function videoId(input) {
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  const u = new URL(input);
  const parts = u.pathname.split('/').filter(Boolean);
  if (u.hostname.replace('www.', '') === 'youtu.be') return parts[0];
  if (parts[0] === 'watch') return u.searchParams.get('v');
  return parts[1];
}

async function grab(label, url, headers, maxBytes) {
  const t = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    const res = await fetch(url, { headers, signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok && res.status !== 206) { console.log(`  ${label}: HTTP ${res.status}`); return false; }
    let got = 0;
    const reader = res.body.getReader();
    while (got < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
    }
    reader.cancel().catch(() => { });
    const secs = (Date.now() - t) / 1000;
    console.log(`  ${label}: HTTP ${res.status}, ${(got / 1048576).toFixed(2)} MB in ${secs.toFixed(1)}s (${(got / 1048576 / Math.max(secs, 0.001)).toFixed(2)} MB/s)`);
    return got > 0;
  } catch (e) {
    console.log(`  ${label}: failed (${e.message})`);
    return false;
  }
}

(async () => {
  const input = process.argv[2];
  if (!input) { console.log('Usage: node scripts/test-youtube-local.js <youtube url>'); process.exit(1); }
  const id = videoId(input);
  console.log('Video ID:', id);

  let visitor;
  try {
    const html = await (await fetch(`${BASE}/watch?v=${id}`, { headers: { 'User-Agent': WEB_UA } })).text();
    const m = html.match(/"VISITOR_DATA":"([^"]+)"/) || html.match(/"visitorData":"([^"]+)"/);
    visitor = m && m[1];
  } catch (e) { /* optional */ }
  console.log('Visitor data:', visitor ? 'found' : 'not found (continuing without)');

  const client = { clientName: 'ANDROID_VR', clientVersion: '1.65.10', deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12L', androidSdkVersion: 32, hl: 'en' };
  if (visitor) client.visitorData = visitor;
  const headers = { 'Content-Type': 'application/json', 'User-Agent': UA, 'X-YouTube-Client-Name': '28', 'X-YouTube-Client-Version': '1.65.10', Origin: 'https://www.youtube.com' };
  if (visitor) headers['X-Goog-Visitor-Id'] = visitor;

  const res = await fetch(`${BASE}/youtubei/v1/player?prettyPrint=false`, {
    method: 'POST', headers,
    body: JSON.stringify({ videoId: id, context: { client }, playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } }, contentCheckOk: true, racyCheckOk: true }),
  });
  console.log('Player request: HTTP', res.status);
  const pr = await res.json();
  const ps = pr.playabilityStatus || {};
  console.log('Playability:', ps.status, ps.reason || '');
  const sd = pr.streamingData || {};
  const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
  console.log('Formats offered:');
  for (const f of all) {
    console.log(`  itag ${f.itag}  ${f.mimeType && f.mimeType.split(';')[0]}  ${f.qualityLabel || f.audioQuality || ''}  url:${f.url ? 'yes' : 'NO'}${f.signatureCipher ? ' (cipher)' : ''}  size:${f.contentLength || '?'}`);
  }
  const muxed = (sd.formats || []).filter(f => f.url && /video\/mp4/.test(f.mimeType || '') && f.audioQuality);
  if (!muxed.length) { console.log('\nRESULT: no downloadable muxed format. The app cannot download this video this way.'); process.exit(2); }
  muxed.sort((a, b) => (b.height || 0) - (a.height || 0));
  const f = muxed[0];
  console.log(`\nTesting download of itag ${f.itag} (${f.qualityLabel}):`);
  const dl = { 'User-Agent': UA };
  const sep = f.url.includes('?') ? '&' : '?';
  const size = Number(f.contentLength) || 0;
  const A = await grab('A) plain GET', f.url, dl, 3 * 1048576);
  const B = await grab('B) Range header', f.url, { ...dl, Range: 'bytes=0-1048575' }, 1048576);
  const C = size ? await grab('C) range= query (what the app uses for files up to 10 MB)', `${f.url}${sep}range=0-${Math.min(size, 10 * 1048576) - 1}`, dl, 3 * 1048576) : false;
  // Higher quality tests: these formats are listed, but may be refused without a PO token.
  const adaptive = sd.adaptiveFormats || [];
  const vid = adaptive.filter(x => x.url && /video\/mp4/.test(x.mimeType || '') && (x.height || 0) >= 720).sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const aud = adaptive.find(x => x.url && /audio\/mp4/.test(x.mimeType || '') && x.itag === 140) || adaptive.find(x => x.url && /audio\/mp4/.test(x.mimeType || ''));
  console.log('\nHigher quality / audio tests (these decide whether more than 360p is possible):');
  let D = false, E = false;
  if (vid) D = await grab(`D) video-only itag ${vid.itag} ${vid.qualityLabel}`, `${vid.url}${vid.url.includes('?') ? '&' : '?'}range=0-1048575`, dl, 1048576);
  if (aud) E = await grab(`E) audio-only itag ${aud.itag} (m4a)`, `${aud.url}${aud.url.includes('?') ? '&' : '?'}range=0-524287`, dl, 524288);
  console.log('\nRESULT:', (A || B || C) ? 'bytes can be downloaded. Send me this whole output.' : 'URLs were returned but downloading was refused (likely needs a PO token).');
  console.log(`SUMMARY  360p muxed: ${(A || B || C) ? 'WORKS' : 'refused'}   high-quality video: ${D ? 'WORKS' : 'refused'}   audio-only: ${E ? 'WORKS' : 'refused'}`);
  process.exit(0);
})().catch(e => { console.log('Script error:', e.message); process.exit(1); });