// Usage (Node 18+, from the repo root):
//   node scripts\test-youtube-visionos.js "<youtube url>" [maxMB=300] [clientVersion=1.02]
// Asks YouTube for the video the way yt-dlp's current default "visionos" client does (no PO token),
// lists what it offers, then downloads the audio stream and the best H.264 720p / 1080p video stream
// in 4 MB pieces (nothing is saved) and reports the first byte where YouTube says 403.
// The client details below come from public sources, not from YouTube, so if the player request is
// refused, try another clientVersion as the third argument.

const CLIENT_VERSION = process.argv[4] || '1.02';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CHUNK = 4 * 1024 * 1024;
const MAX_BYTES = (Number(process.argv[3]) || 300) * 1024 * 1024;

function videoId(input) {
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  const u = new URL(input);
  const parts = u.pathname.split('/').filter(Boolean);
  if (u.hostname.replace('www.', '') === 'youtu.be') return parts[0];
  if (parts[0] === 'watch') return u.searchParams.get('v');
  return parts[1];
}

async function player(id, clientNameHeader) {
  let visitor;
  try {
    const html = await (await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { 'User-Agent': WEB_UA } })).text();
    const m = html.match(/"VISITOR_DATA":"([^"]+)"/) || html.match(/"visitorData":"([^"]+)"/);
    visitor = m && m[1];
  } catch (e) { /* optional */ }
  const client = {
    clientName: 'VISIONOS', clientVersion: CLIENT_VERSION,
    deviceMake: 'Apple', deviceModel: 'RealityDevice17,1', osName: 'visionOS', osVersion: '26.5.23O471', hl: 'en',
  };
  if (visitor) client.visitorData = visitor;
  const headers = { 'Content-Type': 'application/json', 'User-Agent': UA, 'X-YouTube-Client-Version': CLIENT_VERSION, Origin: 'https://www.youtube.com' };
  if (clientNameHeader) headers['X-YouTube-Client-Name'] = clientNameHeader;
  if (visitor) headers['X-Goog-Visitor-Id'] = visitor;
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST', headers,
    body: JSON.stringify({ videoId: id, context: { client }, contentCheckOk: true, racyCheckOk: true }),
  });
  return res.json();
}

async function piece(url, start, end) {
  const sep = url.includes('?') ? '&' : '?';
  try {
    const res = await fetch(`${url}${sep}range=${start}-${end}`, { headers: { 'User-Agent': UA } });
    if (!res.ok && res.status !== 206) return { status: res.status, bytes: 0 };
    return { status: res.status, bytes: (await res.arrayBuffer()).byteLength };
  } catch (e) { return { status: 0, bytes: 0 }; }
}

async function testStream(label, f) {
  const total = Number(f.contentLength);
  const limit = Math.min(total, MAX_BYTES);
  console.log(`\n${label}: itag ${f.itag}, ${(total / 1048576).toFixed(0)} MB, testing ${(limit / 1048576).toFixed(0)} MB`);
  let pos = 0;
  const t0 = Date.now();
  while (pos < limit) {
    const end = Math.min(pos + CHUNK, total) - 1;
    const r = await piece(f.url, pos, end);
    if (r.bytes === 0) {
      console.log(`  REFUSED (HTTP ${r.status}) at byte ${pos} (${(pos / 1048576).toFixed(1)} MB)`);
      return `${label}: REFUSED at ${(pos / 1048576).toFixed(1)} MB`;
    }
    pos += r.bytes;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`  OK, got ${(pos / 1048576).toFixed(0)} MB in ${secs}s`);
  return `${label}: OK to ${(pos / 1048576).toFixed(0)} MB`;
}

(async () => {
  const input = process.argv[2];
  if (!input) { console.log('Usage: node scripts\\test-youtube-visionos.js <youtube url> [maxMB] [clientVersion]'); process.exit(1); }
  const id = videoId(input);
  console.log(`Video ${id}, client VISIONOS ${CLIENT_VERSION}`);
  let pr = await player(id, '101');
  if ((pr.playabilityStatus || {}).status !== 'OK') {
    console.log('With client-name header 101:', (pr.playabilityStatus || {}).status, (pr.playabilityStatus || {}).reason || '');
    pr = await player(id, undefined);
  }
  const status = (pr.playabilityStatus || {}).status;
  console.log('Playability:', status, (pr.playabilityStatus || {}).reason || '');
  if (status !== 'OK') { console.log('\nSUMMARY\n  player request refused - try another clientVersion as the 3rd argument'); process.exit(0); }

  const sd = pr.streamingData || {};
  const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
  const withUrl = all.filter((f) => f.url);
  console.log(`Formats offered: ${all.length}, with a direct URL: ${withUrl.length}, without (cipher/SABR): ${all.length - withUrl.length}`);
  console.log('Muxed (video+sound) formats:', (sd.formats || []).map((f) => `${f.itag}:${f.height}p`).join(', ') || 'none');

  const adaptive = (sd.adaptiveFormats || []).filter((f) => f.url && f.contentLength);
  const isAvc = (f) => /video\/mp4/.test(f.mimeType || '') && /avc1/.test(f.mimeType || '');
  const bestAvc = (maxH) => adaptive.filter((f) => isAvc(f) && f.height <= maxH).sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)[0];
  const audio = adaptive.filter((f) => /audio\/mp4/.test(f.mimeType || '')).sort((a, b) => b.bitrate - a.bitrate)[0];
  console.log('H.264 heights:', [...new Set(adaptive.filter(isAvc).map((f) => f.height))].sort((a, b) => a - b).join(', ') || 'none');
  console.log('AAC audio:', audio ? `itag ${audio.itag}` : 'none');

  const results = [];
  if (audio) results.push(await testStream('audio AAC', audio));
  const v720 = bestAvc(720);
  const v1080 = bestAvc(1080);
  if (v720) results.push(await testStream(`video ${v720.height}p H.264`, v720));
  if (v1080 && (!v720 || v1080.itag !== v720.itag)) results.push(await testStream(`video ${v1080.height}p H.264`, v1080));
  if (!audio && !v720) results.push('no usable audio/H.264 streams with direct URLs');

  console.log('\nSUMMARY');
  for (const r of results) console.log('  ' + r);
  process.exit(0);
})().catch((e) => { console.log('Script error:', e.message); process.exit(1); });
