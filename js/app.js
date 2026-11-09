// 画面の動き：条件の入力 → ODPT取得 → 遅延判定 → 到着ボードに表示
import { buildResult, estimatePax, present, fmt, jstNow, dataTime } from './core.js';
import { fetchArrivals, OdptError, SHARED_RELAY } from './odpt.js';
import { demoRecords } from './demo.js';

const $ = s => document.querySelector(s);
const DEMO = new URLSearchParams(location.search).has('demo');

// ---------- 保存（この端末のブラウザだけ） ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('hnd:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hnd:' + k, JSON.stringify(v)); } catch {} },
};

const settings = {
  key: store.get('odptKey', ''),
  pass: store.get('sharedPass', ''),
  relay: store.get('relayUrl', ''),
  lfDom: store.get('lfDom', 72),
  lfIntl: store.get('lfIntl', 80),
};

const state = {
  threshold: store.get('threshold', '15'),
  scope: store.get('scope', 'all'),
  basis: store.get('basis', 'scheduled'),
  sort: store.get('sort', 'delay'),
  data: null,
};

// ---------- 時刻まわり ----------
const toHM = m => fmt(m);
const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
const nowMin = () => jstNow().minutes;
const roundDown5 = m => m - (m % 5);
const LAST = 23 * 60 + 55;

function setRange(fromMin, toMinV) {
  $('#from').value = toHM(fromMin);
  $('#to').value = toHM(toMinV);
  updateHelp();
}
function updateHelp() {
  const f = toMin($('#from').value), t = toMin($('#to').value);
  $('#rangeHelp').textContent = f != null && t != null && t < f
    ? '0時をまたぐ時間帯として探します（今日の便のみ）。'
    : '今日、羽田に着く便から探します。';
}

// ---------- 条件のボタン ----------
function syncSeg() {
  document.querySelectorAll('.query .seg').forEach(seg => {
    const key = seg.dataset.key;
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(state[key]))));
  });
}
document.querySelectorAll('.query .seg').forEach(seg => {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state[seg.dataset.key] = b.dataset.v; store.set(seg.dataset.key, b.dataset.v); syncSeg();
  });
});
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  const n = roundDown5(nowMin());
  const p = b.dataset.preset;
  setRange(n, p === 'rest' ? LAST : Math.min(n + +p, LAST));
  search();
}));
$('#from').addEventListener('change', updateHelp);
$('#to').addEventListener('change', updateHelp);
$('#cancelled').checked = store.get('cancelled', true);
$('#cancelled').addEventListener('change', e => store.set('cancelled', e.target.checked));
$('#go').addEventListener('click', () => search());

// ---------- 設定ダイアログ ----------
// トークン・中継URL・（共有の中継があれば）パスワードのどれかがあれば検索できる
const canFetch = () => !!(settings.key || settings.relay || (settings.pass && SHARED_RELAY));
$('#passField').hidden = !SHARED_RELAY;
let afterSave = null;
function openSettings(then) {
  afterSave = then || null;
  $('#odptKey').value = settings.key;
  $('#sharedPass').value = settings.pass;
  $('#relayUrl').value = settings.relay;
  $('#lfDom').value = settings.lfDom;
  $('#lfIntl').value = settings.lfIntl;
  if (settings.relay) $('#advanced').open = true;
  $('#gate').classList.add('show');
  (canFetch() ? $('#closeSettings') : $('#odptKey')).focus();
}
function closeSettings() { $('#gate').classList.remove('show'); $('#openSettings').focus(); }
$('#openSettings').addEventListener('click', () => openSettings());
$('#closeSettings').addEventListener('click', closeSettings);
$('#gate').addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });
$('#gateForm').addEventListener('submit', e => {
  e.preventDefault();
  const clamp = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(100, Math.max(30, n)) : d; };
  settings.key = $('#odptKey').value.trim();
  settings.pass = $('#sharedPass').value.trim();
  settings.relay = $('#relayUrl').value.trim();
  settings.lfDom = clamp($('#lfDom').value, 72);
  settings.lfIntl = clamp($('#lfIntl').value, 80);
  store.set('odptKey', settings.key); store.set('sharedPass', settings.pass); store.set('relayUrl', settings.relay);
  store.set('lfDom', settings.lfDom); store.set('lfIntl', settings.lfIntl);
  try { Object.keys(sessionStorage).filter(k => k.startsWith('hnd:odpt:')).forEach(k => sessionStorage.removeItem(k)); } catch {}
  closeSettings();
  const then = afterSave; afterSave = null;
  if (then) then();
});

// ---------- 検索 ----------
async function search({ force = false } = {}) {
  if (!DEMO && !canFetch()) { openSettings(() => search()); return; }
  const from = toMin($('#from').value) ?? roundDown5(nowMin());
  const to = toMin($('#to').value) ?? Math.min(from + 120, LAST);
  const q = {
    from, to,
    threshold: +state.threshold,
    scope: state.scope,
    basis: state.basis,
    includeCancelled: $('#cancelled').checked,
  };
  const go = $('#go'); go.disabled = true; go.textContent = '探しています…';
  renderLoading();
  try {
    const records = DEMO
      ? await new Promise(r => setTimeout(() => r(demoRecords(from, to, q.scope)), 350))
      : await fetchArrivals({ key: settings.key, relay: settings.relay, pass: settings.pass, force });
    state.data = compute(records, q);
    renderBoard(true);
  } catch (e) {
    renderError(e);
  } finally {
    go.disabled = false; go.textContent = '遅れている便を探す';
  }
}

function compute(records, q) {
  const { flights, watched } = buildResult(records, q);
  const opts = { loadFactorDom: settings.lfDom / 100, loadFactorIntl: settings.lfIntl / 100 };
  const items = flights.map(f => present(f, f.cancelled ? null : estimatePax(f, opts)));
  return {
    generatedAt: fmt(nowMin()),
    dataAt: fmt(dataTime(records)),
    query: { from: fmt(q.from), to: fmt(q.to), threshold: q.threshold, basis: q.basis },
    counts: {
      watched,
      delayed: items.filter(f => !f.cancelled).length,
      cancelled: items.filter(f => f.cancelled).length,
    },
    paxTotal: items.reduce((s, f) => s + (f.pax?.estimate || 0), 0),
    flights: items,
  };
}

// ---------- 描画 ----------
const board = $('#board');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => n.toLocaleString('ja-JP');

function renderLoading() {
  board.hidden = false;
  board.innerHTML = `<div class="loading"><div class="flaps" aria-hidden="true"><span></span><span></span><span></span><span></span></div><p>到着便の情報を集めています</p></div>`;
}

function renderError(e) {
  board.hidden = false;
  const needsSettings = e instanceof OdptError && ['no_key', 'bad_key', 'bad_pass', 'blocked', 'relay_unreachable'].includes(e.code);
  board.innerHTML = `<div class="err"><h3>結果を表示できませんでした</h3><p>${esc(e.message || '原因不明のエラーです。')}</p>
    <button class="refresh" type="button" id="errAction">${needsSettings ? '設定を開く' : 'もう一度探す'}</button></div>`;
  $('#errAction').onclick = () => (needsSettings ? openSettings(() => search({ force: true })) : search({ force: true }));
  if (!(e instanceof OdptError)) console.error(e);
}

function delayBadge(f) {
  if (f.cancelled) return `<span class="delay cancel">${esc(f.status?.label || '欠航')}</span>`;
  if (f.timeUnknown) return `<span class="delay unknown">${esc(f.status?.label || '遅れ')}</span>`;
  return `<span class="delay ${f.delayMin >= 60 ? 'big' : ''}">+${f.delayMin}<small>分</small></span>`;
}

function rowHtml(f, i) {
  const [main, ...shares] = f.flightNumbers;
  const kind = f.cancelled ? '' : f.latestKind === 'actual' ? '到着' : f.latest ? '見込み' : '時刻未定';
  const newTime = f.latest || (f.cancelled ? f.scheduled : '--:--');
  const pax = f.pax ? `<div class="pax">約 <b>${num(f.pax.estimate)}</b> 人</div>` : '';
  const conf = f.pax ? { high: '座席数が判明', mid: '機材から推定', low: '路線から推定' }[f.pax.confidence] : '';
  const basis = f.pax ? `${num(f.pax.seats)}席 × 搭乗率 ${Math.round(f.pax.loadFactor * 100)}%` : '';
  return `<li class="row ${f.cancelled ? 'is-cancel' : ''}" style="animation-delay:${Math.min(i, 12) * 45}ms">
    <button type="button" aria-expanded="false" aria-controls="d${i}">
      <div class="t-col">
        ${f.latest && !f.cancelled ? `<div class="t-old">${esc(f.scheduled)}</div>` : ''}
        <div class="t-new">${esc(newTime)}</div>
        <div class="t-kind">${kind}</div>
      </div>
      <div class="m-col">
        <div class="origin">${esc(f.origin.name || '出発地不明')}<span class="from">発</span></div>
        <div class="fnos"><span class="fno">${esc(main || '')}</span>${shares.slice(0, 2).map(s => `<span class="fno sub">${esc(s)}</span>`).join('')}${shares.length > 2 ? `<span class="fno sub">ほか${shares.length - 2}</span>` : ''}</div>
        <div class="meta">${esc(f.airline.name || '')}${f.terminal ? `　${esc(f.terminal)}` : ''}</div>
      </div>
      <div class="r-col">${delayBadge(f)}${pax}</div>
    </button>
    <div class="detail" id="d${i}">
      <dl>
        <dt>予定</dt><dd class="num">${esc(f.scheduled)}</dd>
        ${f.latest ? `<dt>${f.latestKind === 'actual' ? '到着' : '見込み'}</dt><dd class="num">${esc(f.latest)}</dd>` : ''}
        ${f.status ? `<dt>状況</dt><dd>${esc(f.status.label)}</dd>` : ''}
        ${f.terminal || f.gate ? `<dt>到着場所</dt><dd>${esc(f.terminal || '')}${f.gate ? `　ゲート ${esc(f.gate)}` : ''}</dd>` : ''}
        ${f.pax ? `<dt>推定人数</dt><dd>約 ${num(f.pax.estimate)} 人<span class="conf">${conf}</span><br><span class="num">${basis}</span>${f.pax.aircraft ? `　${esc(f.pax.aircraft)}` : ''}</dd>` : ''}
        ${shares.length ? `<dt>共同運航</dt><dd class="num">${shares.map(esc).join('　')}</dd>` : ''}
      </dl>
    </div>
  </li>`;
}

function renderBoard(reveal) {
  const d = state.data; board.hidden = false;
  const list = [...d.flights];
  if (state.sort === 'time') list.sort((a, b) => toMin(a.scheduled) - toMin(b.scheduled));
  const q = d.query;
  const head = `<div class="board-head">
    <p class="board-title"><b>${esc(q.from)}〜${esc(q.to)}</b> に${q.basis === 'latest' ? '着く見込み' : '着く予定'}の便　${d.counts.watched}便中${d.dataAt ? `<span class="data-at">データ ${esc(d.dataAt)} 時点</span>` : ''}${DEMO ? '<span class="demo-badge">デモ表示</span>' : ''}</p>
    <div class="stats">
      <div class="stat s-delay"><div class="v">${d.counts.delayed}<small>便</small></div><div class="k">${q.threshold}分以上の遅れ</div></div>
      <div class="stat"><div class="v">${d.counts.cancelled}<small>便</small></div><div class="k">欠航・行き先変更</div></div>
      <div class="stat"><div class="v">${num(d.paxTotal)}<small>人</small></div><div class="k">遅れ便の推定人数</div></div>
    </div>
    <div class="board-tools">
      <div class="seg" role="group" aria-label="並べ替え" id="sortSeg">
        <button type="button" data-v="delay" aria-pressed="${state.sort === 'delay'}">遅れが大きい順</button>
        <button type="button" data-v="time" aria-pressed="${state.sort === 'time'}">予定時刻順</button>
      </div>
      <button class="refresh" type="button" id="refresh">更新<span class="t">${esc(d.generatedAt)}</span></button>
    </div>
  </div>`;
  const body = list.length
    ? `<ul class="rows ${reveal ? 'reveal' : ''}">${list.map(rowHtml).join('')}</ul>`
    : `<div class="empty"><h3>この時間帯に遅れている便はありません</h3>
       <p>${q.threshold}分以上遅れている便は見つかりませんでした。時間帯を広げるか、遅れの基準を短くすると表示される便が増えます。</p>
       ${q.threshold > 5 ? `<button class="refresh again" type="button" id="lower">5分以上の遅れで探し直す</button>` : ''}</div>`;
  board.innerHTML = head + body;

  $('#sortSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.sort = b.dataset.v; store.set('sort', state.sort); renderBoard(false);
  });
  $('#refresh').onclick = () => search({ force: true });
  const lower = $('#lower');
  if (lower) lower.onclick = () => { state.threshold = '5'; store.set('threshold', '5'); syncSeg(); search(); };
  board.querySelectorAll('.row > button').forEach(btn => btn.addEventListener('click', () => {
    const li = btn.parentElement, open = !li.classList.contains('open');
    li.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open));
  }));
  if (reveal) board.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

// ---------- 初期表示 ----------
syncSeg();
const n = roundDown5(nowMin());
setRange(n, Math.min(n + 120, LAST));
if (DEMO) search();
else if (!canFetch()) openSettings();
