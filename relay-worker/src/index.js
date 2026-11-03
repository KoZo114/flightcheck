// 中継（必要なときだけ使う）
// ブラウザからODPTに直接つながらない場合に、Cloudflare Workers（無料）でODPTの到着便データを中継する。
// アクセストークンはCloudflare側に保存され、GitHubにもブラウザにも出ない。

const ODPT_URL = 'https://api.odpt.org/api/v4/odpt:FlightInformationArrival';
const OPERATORS = { dom: ['odpt.Operator:HND-JAT'], intl: ['odpt.Operator:HND-TIAT'] };
OPERATORS.all = [...OPERATORS.dom, ...OPERATORS.intl];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = okOrigin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET' } });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
    if (!okOrigin) return new Response('Forbidden', { status: 403 });
    if (!env.ODPT_KEY) return new Response('ODPT_KEY is not set', { status: 500, headers: cors });

    const scope = new URL(request.url).searchParams.get('scope');
    const ops = (OPERATORS[scope] || OPERATORS.all).join(',');
    const cacheKey = new Request(`https://relay.cache/${scope || 'all'}`);
    const hit = await caches.default.match(cacheKey);
    if (hit) return new Response(hit.body, { headers: { 'content-type': 'application/json', ...cors } });

    const res = await fetch(`${ODPT_URL}?odpt:operator=${ops}&acl:consumerKey=${encodeURIComponent(env.ODPT_KEY)}`);
    const body = await res.text();
    if (res.ok) ctx.waitUntil(caches.default.put(cacheKey, new Response(body, { headers: { 'cache-control': 'max-age=60' } })));
    return new Response(body, { status: res.status, headers: { 'content-type': 'application/json', ...cors } });
  },
};
