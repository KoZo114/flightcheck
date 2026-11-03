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
const calls = [];
let mode = 'ok';
globalThis.fetch = async url => {
  calls.push(url);
  if (mode === 'blocked') throw new TypeError('Failed to fetch');
  if (mode === 'bad') return new Response('', { status: 401 });
  return new Response(JSON.stringify(recs), { status: 200 });
};
const { fetchArrivals } = await import('../js/odpt.js');

await assert.rejects(fetchArrivals({ scope: 'all' }), e => e.code === 'no_key');
let r = await fetchArrivals({ scope: 'dom', key: 'abc' });
assert.equal(r.length, 11);
assert.ok(calls[0].includes('odpt:operator=odpt.Operator:HND-JAT&acl:consumerKey=abc'));
await fetchArrivals({ scope: 'dom', key: 'abc' });
assert.equal(calls.length, 1, '1分以内はキャッシュを使う');
await fetchArrivals({ scope: 'dom', key: 'abc', force: true });
assert.equal(calls.length, 2, '更新ボタンは取り直す');
await fetchArrivals({ scope: 'all', relay: 'https://relay.example.workers.dev/' });
assert.equal(calls.at(-1), 'https://relay.example.workers.dev/?scope=all');
mode = 'blocked';
await assert.rejects(fetchArrivals({ scope: 'intl', key: 'abc' }), e => e.code === 'blocked' && /中継URL/.test(e.message));
mode = 'bad';
await assert.rejects(fetchArrivals({ scope: 'intl', key: 'abc', force: true }), e => e.code === 'bad_key');

console.log('アプリ部分の確認に合格しました');
