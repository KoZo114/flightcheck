// 中継（relay-worker）の確認：パスワード・許可元・1分ためる仕組み
import assert from 'node:assert/strict';
import worker from '../relay-worker/src/index.js';

const env = { ALLOWED_ORIGIN: 'https://kozo114.github.io', ODPT_KEY: 'k', ACCESS_PASSWORD: 'pass1234' };
const ORIGIN = 'https://kozo114.github.io';
const upstream = [];
globalThis.fetch = async url => { upstream.push(url); return new Response('[{"a":1}]', { status: 200 }); };
const call = (headers = {}, method = 'GET', e = env) => worker.fetch(new Request('https://relay.example/', { method, headers }), e);

// 許可していないページからは使えない
assert.equal((await call({ origin: 'https://evil.example', 'x-flightcheck-pass': 'pass1234' })).status, 403);
// パスワード違い・なし
assert.equal((await call({ origin: ORIGIN, 'x-flightcheck-pass': 'pass123' })).status, 401);
assert.equal((await call({ origin: ORIGIN })).status, 401);
assert.equal(upstream.length, 0, 'パスワードが違えば ODPT に問い合わせない');
// 事前確認（ブラウザが自動で送る）にはパスワード用ヘッダーの許可を返す
const pre = await call({ origin: ORIGIN }, 'OPTIONS');
assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-headers'), 'x-flightcheck-pass');
// 正しいパスワード
const ok = await call({ origin: ORIGIN, 'x-flightcheck-pass': 'pass1234' });
assert.equal(ok.status, 200); assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
assert.equal(await ok.text(), '[{"a":1}]');
assert.ok(upstream[0].includes('odpt:arrivalAirport=odpt.Airport:HND&acl:consumerKey=k'));
// 1分以内は ODPT に取りに行かない
await call({ origin: ORIGIN, 'x-flightcheck-pass': 'pass1234' });
assert.equal(upstream.length, 1, '1分以内はためたデータを返す');
// secret の登録漏れは 500
assert.equal((await call({ origin: ORIGIN, 'x-flightcheck-pass': 'x' }, 'GET', { ...env, ACCESS_PASSWORD: '' })).status, 500);

console.log('中継の確認に合格しました');
