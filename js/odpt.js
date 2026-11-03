// ODPT（公共交通オープンデータセンター）から羽田の到着便を取得する
// ブラウザから直接呼ぶ。つながらない環境では「中継URL」（relay-worker）経由で呼ぶ。

export const ODPT_URL = 'https://api.odpt.org/api/v4/odpt:FlightInformationArrival';
export const OPERATORS = {
  dom: ['odpt.Operator:HND-JAT'],   // 第1・第2ターミナル（国内線）
  intl: ['odpt.Operator:HND-TIAT'], // 第3ターミナル（国際線）
};
OPERATORS.all = [...OPERATORS.dom, ...OPERATORS.intl];

const CACHE_MS = 60 * 1000; // 1分以内の再検索はODPTに取りに行かない

export class OdptError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function readCache(key) {
  try {
    const hit = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.records;
  } catch {}
  return null;
}
function writeCache(key, records) {
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), records })); } catch {}
}

export async function fetchArrivals({ scope = 'all', key = '', relay = '', force = false } = {}) {
  const cacheKey = `hnd:odpt:${scope}:${relay ? 'relay' : 'direct'}`;
  if (!force) {
    const hit = readCache(cacheKey);
    if (hit) return hit;
  }

  let url;
  if (relay) {
    url = `${relay.replace(/\/+$/, '')}/?scope=${encodeURIComponent(scope)}`;
  } else {
    if (!key) throw new OdptError('no_key', 'ODPTのアクセストークンが未設定です。右上の設定から入れてください。');
    const ops = (OPERATORS[scope] || OPERATORS.all).join(',');
    url = `${ODPT_URL}?odpt:operator=${ops}&acl:consumerKey=${encodeURIComponent(key)}`;
  }

  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new OdptError(
      relay ? 'relay_unreachable' : 'blocked',
      relay
        ? '中継URLにつながりませんでした。URLが正しいか、中継の公開が済んでいるかを確認してください。'
        : 'ブラウザからODPTに直接つながりませんでした。通信状況を確認し、続く場合は README の「つながらないとき」の手順で中継URLを設定してください。'
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new OdptError('bad_key', 'アクセストークンが無効か、まだ有効になっていません。開発者サイトで登録完了を確認し、設定から入れ直してください。');
  }
  if (res.status === 429) {
    throw new OdptError('rate', '短時間に検索しすぎました。1分ほど待ってから、もう一度探してください。');
  }
  if (!res.ok) {
    throw new OdptError('upstream', `ODPTからデータを取得できませんでした（${res.status}）。少し待ってから、もう一度探してください。`);
  }
  const records = await res.json();
  if (!Array.isArray(records)) throw new OdptError('format', 'ODPTから想定外の形式のデータが届きました。');
  writeCache(cacheKey, records);
  return records;
}
