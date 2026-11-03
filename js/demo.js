// デモ用：ODPTと同じ形の到着便データを、指定した時間帯に合わせて作る
// index.html?demo で開くと、APIを使わずに本番と同じ処理で表示を確認できる

const pad = n => String(n).padStart(2, '0');
const hm = m => `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(((m % 60) + 60) % 60)}`;

// [出発地, 便名, 航空会社, 運営, ターミナル, 機材, 遅れ(分), 状況]
const POOL = [
  ['CTS', ['JL512', 'NU1512'], 'JAL', 'HND-JAT', 'Terminal1', '787-9', 48, 'Delayed'],
  ['FUK', ['NH256', '6J1256'], 'ANA', 'HND-JAT', 'Terminal2', '787-10', 22, 'EstimatedArrival'],
  ['OKA', ['JL918'], 'JAL', 'HND-JAT', 'Terminal1', null, 75, 'LateArrival'],
  ['GMP', ['KE2709', 'JL5237'], 'KAL', 'HND-TIAT', 'InternationalPassengerTerminal', 'A330-300', 31, 'Delayed'],
  ['ITM', ['NH34'], 'ANA', 'HND-JAT', 'Terminal2', '777-200', 17, 'InAir'],
  ['KOJ', ['BC304'], 'SKY', 'HND-JAT', 'Terminal1', '737-800', 26, 'Delayed'],
  ['HAC', ['NH1894'], 'ANA', 'HND-JAT', 'Terminal2', null, null, 'Cancelled'],
  ['TSA', ['BR192', 'NH5826'], 'EVA', 'HND-TIAT', 'InternationalPassengerTerminal', null, 112, 'Delayed'],
  ['KMJ', ['JL630'], 'JAL', 'HND-JAT', 'Terminal1', null, null, 'Indefinite'],
  ['HKD', ['NH556'], 'ANA', 'HND-JAT', 'Terminal2', null, 3, 'EstimatedArrival'],
  ['SIN', ['SQ634'], 'SIA', 'HND-TIAT', 'InternationalPassengerTerminal', '787-10', 0, 'OnTime'],
];

export function demoRecords(fromMin, toMin, scope = 'all') {
  const span = ((toMin - fromMin + 1440) % 1440) || 120;
  return POOL
    .filter(p => scope === 'all' || (scope === 'intl') === (p[3] === 'HND-TIAT'))
    .map(([org, nos, air, op, term, ac, delay, st], i) => {
      const sched = (fromMin + Math.round(span * (i + 0.5) / POOL.length)) % 1440;
      return {
        '@type': 'odpt:FlightInformationArrival',
        'owl:sameAs': `odpt.FlightInformationArrival:demo.${nos[0]}`,
        'odpt:operator': `odpt.Operator:${op}`,
        'odpt:airline': `odpt.Airline:${air}`,
        'odpt:flightNumber': nos,
        'odpt:flightStatus': `odpt.FlightStatus:${st}`,
        'odpt:departureAirport': `odpt.Airport:${org}`,
        'odpt:arrivalAirportTerminal': `odpt.AirportTerminal:HND.${term}`,
        'odpt:arrivalGate': st === 'Cancelled' ? null : `odpt.AirportGate:HND.${term}.${10 + i * 3}`,
        'odpt:aircraftModel': ac,
        'odpt:scheduledArrivalTime': hm(sched),
        'odpt:estimatedArrivalTime': delay == null ? null : hm(sched + delay),
      };
    });
}
