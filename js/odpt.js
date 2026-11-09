// ODPT（公共交通オープンデータセンター）から羽田の到着便を取得する
// トークンがあればブラウザから直接呼ぶ。パスワードをもらった人は中継（relay-worker）経由で呼ぶ。
// 実際のデータは JAL・ANA が便ごとに出しているので、運営会社ではなく「羽田着」で絞り込む。
// 国内線・国際線の絞り込みは取得後に core.js（buildResult）で行う。

export const ODPT_URL = 'https://api.odpt.org/api/v4/odpt:FlightInformationArrival';
export const HND_FILTER = 'odpt:arrivalAirport=odpt.Airport:HND';

// パスワードで使う人向けの中継（relay-worker を公開したURL）。パスワードがないと使えないので、URL自体は秘密ではない
export const SHARED_RELAY = 'https://flightcheck-relay.ko3-h.workers.dev';
export const PASS_HEADER = 'x-flightcheck-pass';

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

// 使う経路：中継URLの指定 → トークンで直接 → パスワードで共有の中継、の順
export async function fetchArrivals({ key = '', relay = '', pass = '', force = false } = {}) {
  relay = relay || (!key && pass ? SHARED_RELAY : '');
  const cacheKey = `hnd:odpt:${relay ? 'relay' : 'direct'}`;
  if (!force) {
    const hit = readCache(cacheKey);
    if (hit) return hit;
  }

  let url;
  const headers = {};
  if (relay) {
    url = `${relay.replace(/\/+$/, '')}/`;
    if (pass) headers[PASS_HEADER] = pass;
  } else {
    if (!key) throw new OdptError('no_key', SHARED_RELAY
      ? 'パスワードが未設定です。右上の設定から、教えてもらったパスワードを入れてください。'
      : 'ODPTのアクセストークンが未設定です。右上の設定の「詳細設定」から入れてください。');
    url = `${ODPT_URL}?${HND_FILTER}&acl:consumerKey=${encodeURIComponent(key)}`;
  }

  let res;
  try {
    res = await fetch(url, { cache: 'no-store', headers });
  } catch {
    throw new OdptError(
      relay ? 'relay_unreachable' : 'blocked',
      relay
        ? '中継URLにつながりませんでした。URLが正しいか、中継の公開が済んでいるかを確認してください。'
        : 'ブラウザからODPTに直接つながりませんでした。通信状況を確認し、続く場合は README の「つながらないとき」の手順で中継URLを設定してください。'
    );
  }
  if (relay && res.status === 401) {
    throw new OdptError('bad_pass', 'パスワードが違います。教えてもらったパスワードを、設定から入れ直してください。');
  }
  if (relay && res.status === 403) {
    throw new OdptError('relay_forbidden', '中継がこのページからの利用を許可していません。中継を用意した人に知らせてください。');
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
