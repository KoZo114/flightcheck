// デモデータとODPT取得部分の確認（ブラウザなしで実行）
import assert from 'node:assert/strict';
import { demoRecords } from '../js/demo.js';
import { buildResult, estimatePax } from '../js/core.js';

// デモデータが本番と同じ処理を通る
const recs = demoRecords(18 * 60, 20 * 60);
const { flights, watched } = buildResult(recs, { from: 1080, to: 1200, threshold: 15 });
assert.equal(watched, 11);
const nos = flights.map(f => f.flightNumbers[0]);
assert.ok(nos.includes('JL 512') && nos.includes('NH 1894') && nos.includes('JL 630'));
assert.ok(!nos.includes('NH 556') && !nos.includes('SQ 634'), '3分遅れと定刻は出ない');
assert.equal(flights.find(f => f.flightNumbers[0] === 'KE 2709').airline.name, '大韓航空');
assert.equal(estimatePax(flights.find(f => f.flightNumbers[0] === 'JL 512')).aircraft, 'ボーイング787-9');
assert.equal(demoRecords(1080, 1200, 'intl').length, 3);

// ODPT取得：URL組み立て・エラー文・キャッシュ
const store = new Map();
globalThis.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
const calls = [], sent = [];
let mode = 'ok';
globalThis.fetch = async (url, opts = {}) => {
  calls.push(url); sent.push(opts.headers || {});
  if (mode === 'blocked') throw new TypeError('Failed to fetch');
  if (mode === 'bad') return new Response('', { status: 401 });
  return new Response(JSON.stringify(recs), { status: 200 });
};
const { fetchArrivals, SHARED_RELAY, PASS_HEADER } = await import('../js/odpt.js');

await assert.rejects(fetchArrivals({}), e => e.code === 'no_key');
let r = await fetchArrivals({ key: 'abc' });
assert.equal(r.length, 11);
assert.equal(calls[0], 'https://api.odpt.org/api/v4/odpt:FlightInformationArrival?odpt:arrivalAirport=odpt.Airport:HND&acl:consumerKey=abc',
  '運営会社ではなく羽田着で絞り込む（実データは JAL・ANA が出しているため）');
await fetchArrivals({ key: 'abc' });
assert.equal(calls.length, 1, '1分以内はキャッシュを使う');
await fetchArrivals({ key: 'abc', force: true });
assert.equal(calls.length, 2, '更新ボタンは取り直す');
await fetchArrivals({ relay: 'https://relay.example.workers.dev/', pass: 'secret' });
assert.equal(calls.at(-1), 'https://relay.example.workers.dev/');
assert.equal(sent.at(-1)[PASS_HEADER], 'secret', '中継にはパスワードをヘッダーで送る（URLには載せない）');
assert.ok(!calls.at(-1).includes('secret'));
assert.equal(Object.keys(sent[0]).length, 0, 'ODPT へ直接のときは余計なヘッダーを付けない');
if (SHARED_RELAY) {
  await fetchArrivals({ pass: 'secret', force: true });
  assert.equal(calls.at(-1), `${SHARED_RELAY.replace(/\/+$/, '')}/`, 'パスワードだけなら共有の中継を使う');
} else {
  await assert.rejects(fetchArrivals({ pass: 'secret', force: true }), e => e.code === 'no_key', '共有の中継がまだないときはパスワードだけでは使えない');
}
mode = 'blocked';
await assert.rejects(fetchArrivals({ key: 'abc', force: true }), e => e.code === 'blocked' && /中継URL/.test(e.message));
mode = 'bad';
await assert.rejects(fetchArrivals({ key: 'abc', force: true }), e => e.code === 'bad_key');
await assert.rejects(fetchArrivals({ relay: 'https://relay.example.workers.dev', pass: 'wrong', force: true }), e => e.code === 'bad_pass' && /パスワード/.test(e.message));

console.log('アプリ部分の確認に合格しました');
