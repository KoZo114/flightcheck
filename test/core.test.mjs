// node test/core.test.mjs で実行
import assert from 'node:assert/strict';
import { normalize, delayOf, inWindow, buildResult, estimatePax, present, toMinutes, dataTime } from '../js/core.js';

// v4仕様に近い形
const specStyle = {
  'owl:sameAs': 'odpt.FlightInformationArrival:HND-JAT.HND.JL512',
  'odpt:operator': 'odpt.Operator:HND-JAT',
  'odpt:airline': 'odpt.Airline:JAL',
  'odpt:flightNumber': ['JL512', 'NU1512'],
  'odpt:flightStatus': 'odpt.FlightStatus:Delayed',
  'odpt:scheduledArrivalTime': '18:05',
  'odpt:estimatedArrivalTime': '18:53',
  'odpt:departureAirport': 'odpt.Airport:CTS',
  'odpt:arrivalAirportTerminal': 'odpt.AirportTerminal:HND.Terminal1',
  'odpt:arrivalGate': 'odpt.AirportGate:HND.Terminal1.12',
};
// 実データで見られた旧来の形
const legacyStyle = {
  'owl:sameAs': 'odpt.FlightInformationArrival:HND.MM0858',
  'odpt:airline': 'JAL',
  'odpt:operator': 'odpt.Operator:HND-TIAT',
  'odpt:terminal': 'odpt.AirportTerminal:HND.InternationalPassengerTerminal',
  'odpt:flightStatus': 'odpt.FlightStatus:Delayed',
  'odpt:flightNumbers': ['JL0033', 'UL3357'],
  'odpt:aircraftModel': '787-9',
  'odpt:departureAirport': 'odpt.Airport:BKK',
  'odpt:scheduledTime': '18:50',
  'odpt:estimatedTime': '19:35',
};
const onTime = { ...specStyle, 'owl:sameAs': 'x2', 'odpt:flightNumber': ['NH256'], 'odpt:airline': 'odpt.Airline:ANA',
  'odpt:estimatedArrivalTime': '18:20', 'odpt:scheduledArrivalTime': '18:15', 'odpt:departureAirport': 'odpt.Airport:FUK',
  'odpt:flightStatus': 'odpt.FlightStatus:EstimatedArrival' };
const cancelled = { ...specStyle, 'owl:sameAs': 'x3', 'odpt:flightNumber': ['NH1894'], 'odpt:departureAirport': 'odpt.Airport:HAC',
  'odpt:scheduledArrivalTime': '19:00', 'odpt:estimatedArrivalTime': null, 'odpt:flightStatus': 'odpt.FlightStatus:Cancelled' };
const outside = { ...specStyle, 'owl:sameAs': 'x4', 'odpt:scheduledArrivalTime': '21:00', 'odpt:estimatedArrivalTime': '22:30' };
const unknownTime = { ...specStyle, 'owl:sameAs': 'x5', 'odpt:flightNumber': ['JL630'], 'odpt:departureAirport': 'odpt.Airport:KMJ',
  'odpt:scheduledArrivalTime': '19:10', 'odpt:estimatedArrivalTime': null, 'odpt:flightStatus': 'odpt.FlightStatus:Indefinite' };
const codeshareDup = { ...specStyle, 'owl:sameAs': 'x6', 'odpt:flightNumber': ['JL5001'] };
const midnight = { ...specStyle, 'owl:sameAs': 'x7', 'odpt:scheduledArrivalTime': '23:50', 'odpt:estimatedArrivalTime': '00:35' };

// 1. 形の違いを吸収できる
const a = normalize(specStyle), b = normalize(legacyStyle);
assert.deepEqual(a.flightNumbers, ['JL 512', 'NU 1512']);
assert.equal(a.origin.name, '札幌(新千歳)'); assert.equal(a.terminal, 'T1'); assert.equal(a.gate, '12');
assert.equal(a.airline.name, 'JAL'); assert.equal(a.domestic, true);
assert.deepEqual(b.flightNumbers, ['JL 33', 'UL 3357']);
assert.equal(b.terminal, 'T3'); assert.equal(b.domestic, false); assert.equal(b.origin.name, 'バンコク');
assert.equal(delayOf(a).delayMin, 48); assert.equal(delayOf(b).delayMin, 45);

// 2. 日付またぎ
assert.equal(delayOf(normalize(midnight)).delayMin, 45);
assert.equal(inWindow(toMinutes('23:30'), toMinutes('23:00'), toMinutes('01:00')), true);
assert.equal(inWindow(toMinutes('02:00'), toMinutes('23:00'), toMinutes('01:00')), false);
assert.equal(toMinutes('2026-11-03T18:05:00+09:00'), 18 * 60 + 5);

// 3. 時間帯 18:00-20:00、15分以上
const recs = [specStyle, legacyStyle, onTime, cancelled, outside, unknownTime, codeshareDup];
const r = buildResult(recs, { from: 1080, to: 1200, threshold: 15 });
const ids = r.flights.map(f => f.flightNumbers[0]);
assert.ok(!ids.includes('NH 256'), '5分遅れは出ない');
assert.ok(ids.includes('JL 512') && ids.includes('JL 33') && ids.includes('NH 1894') && ids.includes('JL 630'));
assert.equal(r.flights[0].cancelled, true, '欠航が先頭');
assert.equal(r.flights.find(f => f.flightNumbers[0] === 'JL 512').flightNumbers.includes('JL 5001'), true, 'コードシェアを統合');
assert.equal(r.flights.length, 4); assert.equal(r.watched, 5);

// 4. 欠航を隠す、見込み時刻基準
assert.equal(buildResult(recs, { from: 1080, to: 1200, threshold: 15, includeCancelled: false }).flights.some(f => f.cancelled), false);
const late = buildResult(recs, { from: 1320, to: 1380, threshold: 15, basis: 'latest' });
assert.deepEqual(late.flights.map(f => f.scheduled), [1260], '22:30見込みの便は見込み基準で拾える');

// 5. 推定人数
const pb = estimatePax(b); assert.equal(pb.seats, 215); assert.equal(pb.estimate, 172); assert.equal(pb.confidence, 'mid');
const pa = estimatePax(a); assert.equal(pa.seats, 340); assert.equal(pa.confidence, 'low');
assert.equal(estimatePax({ ...a, seatsKnown: 300 }).estimate, 216);
const shown = present({ ...a, ...delayOf(a), cancelled: false, timeUnknown: false }, pa);
assert.equal(shown.scheduled, '18:05'); assert.equal(shown.latest, '18:53');

// 6. 2026-11 に実際の ODPT から届いた形（JAL・ANA が便ごとに出すデータ）
const real = (no, o) => ({
  'owl:sameAs': `odpt.FlightInformationArrival:JAL.HND.${no}`, 'odpt:airline': 'odpt.Operator:JAL', 'odpt:operator': 'odpt.Operator:JAL',
  'odpt:flightNumber': [no], 'odpt:originAirport': 'odpt.Airport:CTS', 'odpt:arrivalAirport': 'odpt.Airport:HND',
  'odpt:arrivalAirportTerminal': 'odpt.AirportTerminal:HND.Terminal1.NorthWing', 'odpt:aircraftType': '73H',
  'odpt:flightStatus': 'odpt.FlightStatus:EstimatedArrival', 'odpt:scheduledArrivalTime': '18:05', ...o,
});
const rj = normalize(real('JL514', { 'odpt:estimatedArrivalTime': '18:35' }));
assert.equal(rj.airline.code, 'JAL'); assert.equal(rj.airline.name, 'JAL');
assert.equal(rj.origin.name, '札幌(新千歳)'); assert.equal(rj.terminal, 'T1'); assert.equal(rj.domestic, true);
assert.equal(estimatePax(rj).aircraft, 'ボーイング737-800', '"73H" は 737-800');
assert.equal(normalize(real('NH50', { 'odpt:aircraftType': '78K' })).aircraftRaw, '78K');
assert.equal(estimatePax(normalize(real('NH50', { 'odpt:aircraftType': '78K' }))).aircraft, 'ボーイング787-9', '787 の派生型は 787-9 に寄せる');
assert.equal(estimatePax(normalize(real('JL70', { 'odpt:aircraftType': '788' }))).aircraft, 'ボーイング787-8');
assert.equal(normalize(real('JL1', { 'odpt:arrivalAirportTerminal': 'odpt.AirportTerminal:HND.Terminal1.SouthWing' })).terminal, 'T1');
assert.equal(normalize(real('NH1', { 'odpt:arrivalAirportTerminal': 'odpt.AirportTerminal:HND.Terminal2' })).terminal, 'T2');
assert.equal(normalize(real('JL001', { 'odpt:originAirport': 'odpt.Airport:SFO' })).domestic, false);

// 6-1. 前日 20:25 予定の便が今日 01:21 に着いたもの（同じ便名の当日便と並んで届く）
const yday = real('JL026', { 'owl:sameAs': 'x.JL026.1', 'odpt:originAirport': 'odpt.Airport:HKG', 'odpt:arrivalAirportTerminal': 'odpt.AirportTerminal:HND.Terminal3',
  'odpt:aircraftType': '789', 'odpt:flightStatus': 'odpt.FlightStatus:Arrived', 'odpt:scheduledArrivalTime': '20:25', 'odpt:actualArrivalTime': '01:21' });
const today = { ...yday, 'owl:sameAs': 'x.JL026.2', 'odpt:actualArrivalTime': undefined, 'odpt:flightStatus': undefined, 'odpt:estimatedArrivalTime': '20:50' };
const ry = buildResult([yday, today], { from: 1200, to: 1260, threshold: 15 });
assert.equal(ry.watched, 1, '前日便は今日の予定に入れない'); assert.equal(ry.flights[0].delayMin, 25);
assert.equal(buildResult([yday, today], { from: 60, to: 120, threshold: 15, basis: 'latest' }).flights[0].delayMin, 296, '見込み基準なら着いた時刻で拾う');

// 6-2. 同時刻・同出発地でも機材が違えば別の便（ANA 777 と エア・ドゥの 767）
const ana = real('NH064', { 'odpt:airline': 'odpt.Operator:ANA', 'odpt:arrivalAirportTerminal': 'odpt.AirportTerminal:HND.Terminal2', 'odpt:aircraftType': '772', 'odpt:estimatedArrivalTime': '18:50' });
const ado = { ...ana, 'owl:sameAs': 'x.NH4724', 'odpt:flightNumber': ['NH4724'], 'odpt:aircraftType': '763', 'odpt:estimatedArrivalTime': '18:30' };
assert.equal(buildResult([ana, ado], { from: 1080, to: 1200, threshold: 15 }).flights.length, 2);

// 6-3. 状況が空でも「出発遅延」のお知らせがあれば、時刻未定の遅れとして出す
const notice = real('JL600', { 'odpt:flightStatus': undefined, 'odpt:flightInformationSummary': { en: 'Delayed', ja: '出発遅延' } });
const rn = buildResult([notice], { from: 1080, to: 1200, threshold: 15 });
assert.equal(rn.flights.length, 1); assert.equal(rn.flights[0].timeUnknown, true); assert.equal(rn.flights[0].status.label, '出発遅延');

// 6-4. 国内線・国際線の絞り込みは取得後に行う
const intlRec = real('JL001', { 'odpt:originAirport': 'odpt.Airport:SFO', 'odpt:estimatedArrivalTime': '18:45' });
const mixed = [real('JL514', { 'odpt:estimatedArrivalTime': '18:35' }), intlRec];
assert.deepEqual(buildResult(mixed, { from: 1080, to: 1200, threshold: 15, scope: 'dom' }).flights.map(f => f.flightNumbers[0]), ['JL 514']);
assert.deepEqual(buildResult(mixed, { from: 1080, to: 1200, threshold: 15, scope: 'intl' }).flights.map(f => f.flightNumbers[0]), ['JL 1']);
assert.equal(buildResult(mixed, { from: 1080, to: 1200, threshold: 15 }).flights.length, 2);

// 7. データの作成時刻（dc:date の最新）を出す
assert.equal(dataTime([{ 'dc:date': '2026-11-09T16:09:36+09:00' }, { 'dc:date': '2026-11-09T16:13:17+09:00' }, {}]), 16 * 60 + 13);
assert.equal(dataTime([{}]), null);

console.log('すべてのテストに合格しました', r.flights.map(f => `${f.flightNumbers[0]} ${f.delayMin ?? f.status.label}`));
