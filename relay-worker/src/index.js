// 中継（パスワードを知っている人に、利用者のトークンで到着便データを見せる）
// Cloudflare Workers（無料）で動かす。アクセストークンとパスワードは Cloudflare の secret に置き、
// GitHub にもブラウザにも出さない。
//   ODPT_KEY        … ODPT のアクセストークン
//   ACCESS_PASSWORD … 画面で入れてもらうパスワード

const ODPT_URL = 'https://api.odpt.org/api/v4/odpt:FlightInformationArrival';
const HND_FILTER = 'odpt:arrivalAirport=odpt.Airport:HND'; // 羽田着の便すべて（国内線・国際線の絞り込みは画面側で行う）
const PASS_HEADER = 'x-flightcheck-pass';
const CACHE_MS = 60 * 1000;

// workers.dev では Cache API が効かないことがあるので、メモリに1分ためて ODPT への問い合わせを減らす
let cached = null; // { at, body }

// 文字列を同じ時間で比べる（パスワードの推測を難しくする）
function sameText(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = okOrigin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
    const reply = (body, status, type = 'text/plain; charset=utf-8') =>
      new Response(body, { status, headers: { 'content-type': type, 'cache-control': 'no-store', ...cors } });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET', 'access-control-allow-headers': PASS_HEADER, 'access-control-max-age': '86400' } });
    }
    if (request.method !== 'GET') return reply('Method not allowed', 405);
    if (!okOrigin) return reply('Forbidden', 403);
    if (!env.ODPT_KEY || !env.ACCESS_PASSWORD) return reply('ODPT_KEY or ACCESS_PASSWORD is not set', 500);
    if (!sameText(request.headers.get(PASS_HEADER) || '', env.ACCESS_PASSWORD)) return reply('Wrong password', 401);

    if (cached && Date.now() - cached.at < CACHE_MS) return reply(cached.body, 200, 'application/json');

    const res = await fetch(`${ODPT_URL}?${HND_FILTER}&acl:consumerKey=${encodeURIComponent(env.ODPT_KEY)}`);
    // ODPT 側でトークンが通らないときは、画面の「パスワードが違う」と区別できるよう 502 で返す
    if (!res.ok) return reply(`ODPT error ${res.status}`, res.status === 429 ? 429 : 502);
    const body = await res.text();
    cached = { at: Date.now(), body };
    return reply(body, 200, 'application/json');
  },
};
