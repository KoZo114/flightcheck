// 到着便データの整形・遅延判定・人数推定（外部通信なしの純粋な処理）
import { AIRPORTS, AIRLINES, DOMESTIC, TRUNK, SEATS, normalizeAircraft } from './data.js';

const STATUS_JA = {
  Adjusting: '機材繰り', Arrived: '到着済み', BaggageAvailable: '手荷物引渡中', Cancelled: '欠航',
  Delayed: '遅れ', EstimatedArrival: '到着予定', InAir: '航行中', Indefinite: '時刻未定',
  Landed: '着陸済み', LateArrival: '使用機遅れ', Maintenance: '使用機整備', NewTime: '時刻変更',
  OnTime: '定刻', Other: 'その他', PostponedTomorrow: '翌日運航', Takeoff: '離陸済み',
  Unknown: '不明', WeatherCheck: '天候調査中', Yesterday: '昨日便', DestinationChanged: '到着地変更',
  BadWeather: '天候不良', Diverted: '到着地変更', ExtraFlight: '臨時便',
};
const DELAY_STATUSES = new Set(['Delayed', 'LateArrival', 'Maintenance', 'NewTime', 'Indefinite', 'WeatherCheck', 'Adjusting', 'BadWeather']);
const CANCEL_STATUSES = new Set(['Cancelled', 'PostponedTomorrow', 'Diverted', 'DestinationChanged']);

const strip = (v, prefix) => (v == null ? null : String(v).replace(prefix, ''));
const first = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');

// 日本時間の「今日」(YYYY-MM-DD) と 0時からの分
export function jstNow(date = new Date()) {
  const j = new Date(date.getTime() + 9 * 3600e3);
  return { ymd: j.toISOString().slice(0, 10), minutes: j.getUTCHours() * 60 + j.getUTCMinutes() };
}

// "18:05" / "2026-11-03T18:05:00+09:00" → 0時からの分（日本時間）
export function toMinutes(v) {
  if (v == null || v === '') return null;
  const s = String(v);
  const hm = s.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return (+hm[1] % 24) * 60 + +hm[2];
  const d = new Date(s);
  if (isNaN(d)) return null;
  return jstNow(d).minutes;
}

export const fmt = m => (m == null ? null : `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`);

function flightNo(raw) {
  const s = String(raw).toUpperCase().replace(/\s/g, '');
  const m = s.match(/^([A-Z0-9]{2})(\d+)([A-Z]?)$/);
  return m ? `${m[1]} ${parseInt(m[2], 10)}${m[3]}` : s;
}

function terminalLabel(raw) {
  const s = String(raw || '');
  if (/International|Terminal3|T3/i.test(s)) return 'T3';
  if (/Terminal1|T1|North|JAL/i.test(s)) return 'T1';
  if (/Terminal2|T2|South|ANA/i.test(s)) return 'T2';
  return s ? s.split('.').pop() : null;
}

// ODPT のレコード1件を扱いやすい形にそろえる（仕様と実データの揺れを吸収）
export function normalize(r) {
  const nums = [].concat(first(r['odpt:flightNumber'], r['odpt:flightNumbers'], []) || []).filter(Boolean);
  const flightNumbers = [...new Set(nums.map(flightNo))];
  const airlineRaw = strip(first(r['odpt:airline'], null), 'odpt.Airline:') || (flightNumbers[0] || '').slice(0, 2);
  const origin = strip(first(r['odpt:departureAirport'], r['odpt:originAirport']), 'odpt.Airport:');
  const status = strip(first(r['odpt:flightStatus'], null), 'odpt.FlightStatus:');
  const scheduled = toMinutes(first(r['odpt:scheduledArrivalTime'], r['odpt:scheduledTime']));
  const estimated = toMinutes(first(r['odpt:estimatedArrivalTime'], r['odpt:estimatedTime']));
  const actual = toMinutes(first(r['odpt:actualArrivalTime'], r['odpt:actualTime']));
  const gate = strip(first(r['odpt:arrivalGate'], r['odpt:gate']), /^.*\./);
  return {
    id: first(r['owl:sameAs'], r['@id'], `${flightNumbers[0]}-${scheduled}`),
    flightNumbers,
    airline: { code: airlineRaw, name: AIRLINES[airlineRaw] || AIRLINES[(flightNumbers[0] || '').slice(0, 2)] || airlineRaw },
    origin: { code: origin, name: AIRPORTS[origin] || origin },
    domestic: origin ? DOMESTIC.has(origin) : !/TIAT/.test(r['odpt:operator'] || ''),
    terminal: terminalLabel(first(r['odpt:arrivalAirportTerminal'], r['odpt:terminal'])),
    gate: gate || null,
    status: status ? { code: status, label: STATUS_JA[status] || status } : null,
    aircraftRaw: first(r['odpt:aircraftModel'], r['odpt:aircraftType'], null),
    scheduled, estimated, actual,
  };
}

// 予定と最新（実績→見込みの順）との差。日付またぎも考慮
export function delayOf(f) {
  const latest = f.actual ?? f.estimated;
  if (f.scheduled == null || latest == null) return { latest: null, latestKind: null, delayMin: null };
  let d = latest - f.scheduled;
  if (d < -720) d += 1440;
  if (d > 720) d -= 1440;
  return { latest, latestKind: f.actual != null ? 'actual' : 'estimated', delayMin: d };
}

export function inWindow(m, from, to) {
  if (m == null) return false;
  return from <= to ? m >= from && m <= to : m >= from || m <= to; // 0時またぎ
}

// コードシェアが別レコードで来た場合にひとつへまとめる
export function dedupe(list) {
  const map = new Map();
  for (const f of list) {
    const key = `${f.scheduled}|${f.origin.code}|${f.terminal}`;
    const hit = map.get(key);
    if (hit) hit.flightNumbers = [...new Set([...hit.flightNumbers, ...f.flightNumbers])];
    else map.set(key, { ...f, flightNumbers: [...f.flightNumbers] });
  }
  return [...map.values()];
}

// 推定人数。機材がわかれば座席数から、わからなければ路線から目安を出す
export function estimatePax(f, opts = {}) {
  const lfDom = opts.loadFactorDom ?? 0.72;
  const lfIntl = opts.loadFactorIntl ?? 0.8;
  const lf = f.domestic ? lfDom : lfIntl;
  if (f.seatsKnown) {
    return { estimate: Math.round(f.seatsKnown * lf), seats: f.seatsKnown, loadFactor: lf, aircraft: f.aircraftName || null, confidence: 'high' };
  }
  const code = normalizeAircraft(f.aircraftRaw);
  if (code) {
    const seats = f.domestic ? SEATS[code].dom : SEATS[code].intl;
    return { estimate: Math.round(seats * lf), seats, loadFactor: lf, aircraft: SEATS[code].name, confidence: 'mid' };
  }
  const big = ['JAL', 'ANA', 'JL', 'NH'].includes(f.airline.code) || ['JAL', 'ANA'].includes(f.airline.name);
  let seats;
  if (!f.domestic) seats = 250;
  else if (big && TRUNK.has(f.origin.code)) seats = 340;
  else seats = 166;
  return { estimate: Math.round(seats * lf), seats, loadFactor: lf, aircraft: null, confidence: 'low' };
}

// 画面に返す結果を組み立てる
export function buildResult(records, q, opts = {}) {
  const { from, to, threshold = 15, basis = 'scheduled', includeCancelled = true } = q;
  const flights = dedupe(records.map(normalize));
  const out = [];
  let watched = 0;
  for (const f of flights) {
    const d = delayOf(f);
    const ref = basis === 'latest' ? (d.latest ?? f.scheduled) : f.scheduled;
    if (!inWindow(ref, from, to)) continue;
    watched++;
    const code = f.status?.code;
    const cancelled = CANCEL_STATUSES.has(code);
    const flaggedLate = DELAY_STATUSES.has(code);
    const late = d.delayMin != null ? d.delayMin >= threshold : flaggedLate;
    if (cancelled ? !includeCancelled : !late) continue;
    out.push({ ...f, ...d, cancelled, timeUnknown: !cancelled && d.delayMin == null });
  }
  out.sort((a, b) => (b.cancelled - a.cancelled) || ((b.delayMin ?? 9999) - (a.delayMin ?? 9999)) || a.scheduled - b.scheduled);
  return { flights: out, watched };
}

export function present(f, pax) {
  return {
    id: f.id,
    flightNumbers: f.flightNumbers,
    airline: f.airline,
    origin: f.origin,
    domestic: f.domestic,
    terminal: f.terminal,
    gate: f.gate,
    status: f.status,
    scheduled: fmt(f.scheduled),
    latest: fmt(f.latest),
    latestKind: f.latestKind,
    delayMin: f.delayMin,
    cancelled: f.cancelled,
    timeUnknown: f.timeUnknown,
    pax,
  };
}
